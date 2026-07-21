/**
 * Custom Hooks for Browser WebView
 * 
 * Separates concerns and makes browser logic reusable and testable
 */

import { useState, useRef, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { metadataService } from '../utils/extractors/MetadataService';
import { MangaMetadata } from '../utils/extractors/types';
import { extractChapterNumber } from '../utils/mangaHelpers';
import { apiService } from '../services/api.service';

/**
 * Bridge between useMetadataExtraction (which owns the WebView ref and the
 * single `onMessage` handler wired up in the browser screen) and
 * useProgressTracking (which knows the userMangaId and performs the API
 * update). Only used for adapters whose chapter URLs don't contain a usable
 * chapter number (see BaseWebsiteAdapter.getChapterNumberScript()) - for
 * those we extract the chapter number from the DOM instead of the URL, and
 * this listener lets that async, injected-script result reach the progress
 * tracker without threading extra props through the screen.
 */
type ChapterNumberListener = (url: string, chapterNumber: string) => void;
let chapterNumberListener: ChapterNumberListener | null = null;

/** Marker field used to tell a chapter-number payload apart from normal metadata messages. */
const CHAPTER_NUMBER_PAYLOAD_FLAG = '_chapterNumberPayload';

/**
 * Wraps an adapter's getChapterNumberScript() output so it posts its result
 * back through the WebView's message channel, tagged so it can be
 * distinguished from regular metadata extraction messages.
 */
function buildChapterNumberInjectionScript(baseScript: string): string {
  return `
    (function() {
      try {
        const result = ${baseScript};
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        const payload = {
          ${CHAPTER_NUMBER_PAYLOAD_FLAG}: true,
          chapterNumber: parsed && parsed.chapterNumber ? String(parsed.chapterNumber) : null,
          sourceUrl: window.location.href.split('?')[0],
        };
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      } catch (e) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            ${CHAPTER_NUMBER_PAYLOAD_FLAG}: true,
            chapterNumber: null,
            error: e.message,
          }));
        }
      }
    })();
    true;
  `;
}

/**
 * Hook for managing WebView navigation state
 */
// react-native-webview's onLoadStart/onLoadEnd pair is fired around the main
// document's load lifecycle. For SPA-style sites (client-side navigation,
// lazy content, ads/analytics kicking off more requests after "load") these
// events can desync from what's actually on screen - onLoadEnd can be late,
// get raced by a subsequent onLoadStart for a sub-resource, or simply never
// fire for an in-page navigation. `navState.loading` from
// onNavigationStateChange is the more reliable, idiomatic signal (one event,
// one boolean, always kept in sync by the native layer), so it's the source
// of truth for the spinner here. onLoadStart/onLoadEnd in the screen are kept
// only as an immediate secondary signal; either way, the safety timeout below
// guarantees the spinner can never get stuck forever even if every event is
// missed.
const LOADING_SAFETY_TIMEOUT_MS = 8000;

export function useWebViewNavigation(webViewRef: React.RefObject<WebView | null>) {
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Belt-and-braces: whenever loading flips to true, arm a timer that force-
  // clears it a few seconds later no matter what. This makes a stuck spinner
  // impossible even if navState.loading and onLoadStart/onLoadEnd all fail to
  // report the page finished (e.g. a missed event on some SPA navigation).
  useEffect(() => {
    if (loading) {
      safetyTimeoutRef.current = setTimeout(() => {
        setLoading(false);
      }, LOADING_SAFETY_TIMEOUT_MS);
    } else if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, [loading]);

  const handleNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setCurrentUrl(navState.url);
    // Source of truth for the loading spinner - see comment above.
    if (typeof navState.loading === 'boolean') {
      setLoading(navState.loading);
    }
  };

  const handleBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    }
  };

  const handleForward = () => {
    if (canGoForward && webViewRef.current) {
      webViewRef.current.goForward();
    }
  };

  const handleRefresh = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  return {
    canGoBack,
    canGoForward,
    currentUrl,
    loading,
    setLoading,
    handleNavigationStateChange,
    handleBack,
    handleForward,
    handleRefresh,
  };
}

/**
 * Hook for metadata extraction from manga pages
 */
export function useMetadataExtraction(
  webViewRef: React.RefObject<WebView | null>,
  currentUrl: string,
  showOverlay: boolean,
  onUnsupportedWebsite?: () => void,
  onExtractionFailed?: () => void
) {
  const [extractedMetadata, setExtractedMetadata] = useState<MangaMetadata | null>(null);
  // Timestamps for the last injected script of each kind, so the round-trip
  // (inject -> WebView JS runs -> postMessage back) can be timed on receipt.
  const metadataInjectStartRef = useRef<number | null>(null);
  const chapterInjectStartRef = useRef<number | null>(null);
  // Tracks which URL we've already successfully extracted metadata for, so
  // the retry attempts below can stop early once one succeeds, and so a
  // stale success from a previous URL doesn't count for a new one.
  const extractedForUrlRef = useRef<string | null>(null);

  // Auto-extract metadata when navigating to manga detail pages.
  //
  // A single fixed-delay attempt is inherently racy: if the user taps into a
  // chapter before the delay elapses, the effect's cleanup cancels it and no
  // metadata ever gets cached for this series - the exact "add to library
  // works sometimes, not others" symptom, since handleAddToLibrary (in
  // browser.tsx) relies on this cached metadata once the user is on a
  // chapter page (where live extraction is intentionally disabled). Multiple
  // staggered attempts raise the odds of catching the page: fast for
  // fast-loading pages/quick navigators, with later retries as a backstop
  // for slow-loading ones (ads, lazy content, interstitial overlays).
  useEffect(() => {
