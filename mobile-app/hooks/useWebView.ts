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
    if (!currentUrl || showOverlay) return;
    if (!metadataService.isMangaDetailPage(currentUrl)) return;

    extractedForUrlRef.current = null;
    const delaysMs = [800, 2200, 4000];
    const timers = delaysMs.map((delay) =>
      setTimeout(() => {
        if (extractedForUrlRef.current === currentUrl) return; // already got it
        extractMetadata(currentUrl, false);
      }, delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [currentUrl, showOverlay]);

  // For chapter pages on adapters whose URLs don't carry a usable chapter
  // number (e.g. WeebCentral's ULID chapter IDs), inject a DOM-reading script
  // to recover the chapter number for progress tracking. This is separate
  // from the metadata extraction above - it never triggers the "Add to
  // Library" overlay and doesn't touch MetadataService's chapter-page skip.
  useEffect(() => {
    if (!currentUrl || showOverlay) return;

    const adapter = metadataService.getExtractorForUrl(currentUrl);
    if (!adapter || !adapter.isChapterPage(currentUrl)) return;

    const baseScript = adapter.getChapterNumberScript?.();
    if (!baseScript) return;

    const timer = setTimeout(() => {
      const script = buildChapterNumberInjectionScript(baseScript);
      chapterInjectStartRef.current = Date.now();
      webViewRef.current?.injectJavaScript(script);
    }, 2000); // let the reader page's dynamic content (dropdown/title) settle

    return () => clearTimeout(timer);
  }, [currentUrl, showOverlay]);

  const extractMetadata = async (url: string, isManual: boolean = false) => {
    const adapter = metadataService.getExtractorForUrl(url);

    if (!adapter) {
      if (isManual) {
        onUnsupportedWebsite?.();
      }
      return false;
    }

    const script = metadataService.getInjectionScript(url);
    if (!script) {
      if (isManual) {
        onExtractionFailed?.();
      }
      return false;
    }

    try {
      metadataInjectStartRef.current = Date.now();
      await webViewRef.current?.injectJavaScript(script);
      return true;
    } catch (error) {
      console.log('[useMetadataExtraction] Failed to inject script:', error);
      if (isManual) {
        onExtractionFailed?.();
      }
      return false;
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const messageData = event.nativeEvent.data;
      console.log('[useMetadataExtraction] Received message from WebView');

      // Chapter-number payloads (from getChapterNumberScript injection) are
      // tagged so they can be routed to progress tracking instead of being
      // parsed as manga metadata.
      try {
        const parsed = JSON.parse(messageData);
        if (parsed && parsed[CHAPTER_NUMBER_PAYLOAD_FLAG]) {
          const elapsedMs = chapterInjectStartRef.current ? Date.now() - chapterInjectStartRef.current : null;
          chapterInjectStartRef.current = null;
          if (parsed.chapterNumber) {
            console.log(`[useMetadataExtraction] Chapter number extracted from DOM: ${parsed.chapterNumber} (${elapsedMs}ms)`);
            chapterNumberListener?.(parsed.sourceUrl || currentUrl, parsed.chapterNumber);
          } else {
            console.log(`[useMetadataExtraction] Chapter number DOM extraction found nothing (${elapsedMs}ms)`, parsed.error || '');
          }
          return;
        }
      } catch {
        // Not JSON, or not a chapter-number payload - fall through to normal metadata parsing.
      }

      const elapsedMs = metadataInjectStartRef.current ? Date.now() - metadataInjectStartRef.current : null;
      metadataInjectStartRef.current = null;

      const parseStart = Date.now();
      const metadata = metadataService.parseMetadata(messageData);
      const parseMs = Date.now() - parseStart;

      if (metadata) {
        extractedForUrlRef.current = currentUrl;
        setExtractedMetadata(metadata);
        console.log(`[useMetadataExtraction] Successfully extracted: ${metadata.title} (round-trip ${elapsedMs}ms, parse ${parseMs}ms)`);
      } else {
        console.log(`[useMetadataExtraction] Extraction returned no metadata (round-trip ${elapsedMs}ms, parse ${parseMs}ms)`);
      }
    } catch (error) {
      console.log('[useMetadataExtraction] Error handling message:', error);
    }
  };

  const clearMetadata = () => {
    setExtractedMetadata(null);
  };

  return {
    extractedMetadata,
    extractMetadata,
    handleWebViewMessage,
    clearMetadata,
  };
}

/**
 * Hook for tracking reading progress
 */
export function useProgressTracking(userMangaId?: string) {
  const progressUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Tracks the last chapter/url we successfully sent, so the async
  // DOM-extraction path (see chapterNumberListener) doesn't fire a duplicate
  // update for a chapter we already recorded via the URL-regex fast path.
  const lastReportedRef = useRef<{ url: string; chapterNumber: string } | null>(null);

  const sendProgressUpdate = async (url: string, chapterNumber: string) => {
    if (!userMangaId) return;
    if (
      lastReportedRef.current &&
      lastReportedRef.current.url === url &&
      lastReportedRef.current.chapterNumber === chapterNumber
    ) {
      return;
    }

    try {
      console.log('[useProgressTracking] Updating - Chapter:', chapterNumber);

      await apiService.updateMangaProgress(userMangaId, {
        lastReadUrl: url,
        currentChapter: chapterNumber,
        status: 'reading',
      });

      lastReportedRef.current = { url, chapterNumber };
      console.log('[useProgressTracking] Progress updated successfully');
    } catch (error) {
      console.log('[useProgressTracking] Failed to update progress:', error);
    }
  };

  // Receive DOM-extracted chapter numbers for adapters whose chapter URLs
  // don't carry a usable chapter number (e.g. WeebCentral). See
  // useMetadataExtraction's chapter-number injection effect, which is what
  // populates this via chapterNumberListener.
  useEffect(() => {
    chapterNumberListener = (url, chapterNumber) => {
      sendProgressUpdate(url, chapterNumber);
    };

    return () => {
      if (chapterNumberListener) {
        chapterNumberListener = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMangaId]);

  useEffect(() => {
    return () => {
      if (progressUpdateTimeoutRef.current) {
        clearTimeout(progressUpdateTimeoutRef.current);
      }
    };
  }, []);

  const updateProgress = (url: string) => {
    if (!userMangaId) return;

    // Clear any pending update
    if (progressUpdateTimeoutRef.current) {
      clearTimeout(progressUpdateTimeoutRef.current);
    }

    // Debounce progress updates (wait 2 seconds after navigation stops)
    progressUpdateTimeoutRef.current = setTimeout(async () => {
      // Only ever try to read a chapter number out of a URL the adapter
      // itself confirms is a chapter page. Without this gate, a
      // client-rendered site (MangaFire) can briefly navigate through an
      // intermediate URL built from its own internal chapter ID before JS
      // rewrites the address bar to the real page URL - that transient URL
      // slipped past the debounce and got fed to extractChapterNumber(),
      // which (having no reason to expect anything but a real chapter page)
      // matched the ID itself as if it were a chapter number (e.g. a
      // 7-digit ID logged as "Chapter 9368024"). isChapterPage() is the
      // same check MetadataService already applies before extraction; this
      // path just wasn't gated on it before.
      const adapter = metadataService.getExtractorForUrl(url);
      if (!adapter?.isChapterPage(url)) return;

      // Fast path: chapter number is embedded in the URL (AsuraScans, MangaFire, ...).
      // If it's not there, we leave it to the async DOM-extraction path
      // (chapterNumberListener above) for adapters that support it - see
      // WeebCentralAdapter.getChapterNumberScript().
      const chapterNumber = extractChapterNumber(url);
      if (chapterNumber) {
        await sendProgressUpdate(url, chapterNumber);
      }
    }, 2000);
  };

  return { updateProgress };
}
