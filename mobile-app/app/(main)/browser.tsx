import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ActivityIndicator, Platform, BackHandler, Animated, Easing } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as NavigationBar from 'expo-navigation-bar';
import ReaderOverlay from '../../components/ReaderOverlay';
import { metadataService } from '../../utils/extractors/MetadataService';
import { 
  useWebViewNavigation, 
  useMetadataExtraction, 
  useProgressTracking 
} from '../../hooks/useWebView';
import { useTheme } from '../../constants/ThemeContext';
import { Toast, useToast } from '../../components/Toast';
import { isAdUrl, AD_BLOCK_INJECTED_JS } from '../../utils/adBlock';
import { Ionicons } from '@expo/vector-icons';

// A hardcoded *desktop* Chrome UA on a mobile WebView is an easy fingerprint
// mismatch for anti-bot checks (like Cloudflare's JS challenge) to flag,
// since the WebView's actual JS engine/capabilities are mobile, not desktop.
// Use a UA that matches what each platform's WebView engine really is:
// Android WebView is Chromium-based, iOS WebView is WebKit-based (Safari).
const MOBILE_USER_AGENT = Platform.select({
  android:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ios:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  default:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
});

export default function BrowserScreen() {
  const { colors, type } = useTheme();
  const params = useLocalSearchParams();
  const router = useRouter();
  const screenNav = useNavigation();
  const webViewRef = useRef<WebView>(null);
  
  // Component state
  const [showOverlay, setShowOverlay] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  // URL params
  const websiteName = params.name as string || 'Browser';
  let websiteUrl = params.url as string;
  const websiteColor = (params.color as string) || colors.accent;
  // State, not a plain const from params: when the user adds this manga to
  // their library mid-session (starting from Sources, not from an existing
  // library entry), the newly-created entry's id needs to flow back in here
  // so progress tracking (and the "already in library" gate) start working
  // immediately, instead of only after leaving and reopening via "Continue
  // Reading" - see ReaderOverlay's onSuccess below.
  const [userMangaId, setUserMangaId] = useState<string | undefined>(
    params.userMangaId as string | undefined
  );
  
  // Convert mobile Webtoons URLs to desktop version (more compatible)
  if (websiteUrl && websiteUrl.includes('m.webtoons.com')) {
    websiteUrl = websiteUrl.replace('m.webtoons.com', 'www.webtoons.com');
  }

  // Custom hooks for separation of concerns
  const navigation = useWebViewNavigation(webViewRef);
  const metadata = useMetadataExtraction(
    webViewRef, 
    navigation.currentUrl, 
    showOverlay,
    () => showToast('This website is not supported yet', 'warning'),
    () => showToast('Failed to extract manga information', 'error')
  );
  const progress = useProgressTracking(userMangaId);

  // Back gesture/button handling. Without this, a swipe-back (or Android's
  // back button) always pops this whole screen straight to wherever it was
  // pushed from - even mid-chapter, with the WebView itself still holding
  // page-to-page history it could have stepped back through instead. Fix:
  // while the WebView has internal back history (navigation.canGoBack - e.g.
  // chapter -> detail page, or page 3 -> page 2 of a chapter list), back
  // steps through THAT first, exactly like a browser tab's back button.
  // Only once the WebView has no more internal history does back actually
  // close this screen - at which point it's left to the DEFAULT pop target
  // (whichever screen pushed this one, Home in the common case), same as
  // closing a browser tab returns you to whatever was behind it. Do not
  // call router navigation from inside the 'beforeRemove'/hardware-back
  // handlers for that case - preventDefault() plus an immediate navigate
  // from inside these listeners re-triggers them recursively and blows
  // React's update-depth limit (hit this live: "Maximum update depth
  // exceeded"). Simply returning false / not preventing default lets the
  // navigator's own removal proceed exactly once, safely.
  // Explicit "leave this screen right now" actions (the Home button) need
  // to bypass the beforeRemove guard below entirely - otherwise it can't
  // tell an intentional exit apart from a back gesture, and steps through
  // WebView history instead of actually leaving (this is exactly what
  // happened before this ref existed: pressing Home first walked back
  // through read chapters one at a time rather than going straight to the
  // Library).
  const bypassBackGuardRef = useRef(false);

  useEffect(() => {
    const handleBackPress = () => {
      if (navigation.canGoBack) {
        navigation.handleBack();
        return true; // handled - don't let the OS/navigator do anything else
      }
      return false; // let the default back behavior close this screen
    };

    const backHandlerSub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    // Covers the iOS edge-swipe gesture and Android's predictive-back
    // gesture, neither of which fire 'hardwareBackPress' - both instead ask
    // the navigator to remove this screen, which this listener can veto.
    const unsubscribeBeforeRemove = screenNav.addListener('beforeRemove', (e: any) => {
      if (bypassBackGuardRef.current) return; // explicit exit - let it through untouched
      if (navigation.canGoBack) {
        e.preventDefault();
        navigation.handleBack();
      }
      // else: no WebView history left - don't preventDefault, let the
      // screen close normally.
    });

    return () => {
      backHandlerSub.remove();
      unsubscribeBeforeRemove();
    };
  }, [navigation.canGoBack, screenNav]);

  // Handle navigation changes
  const handleNavigationStateChange = (navState: any) => {
    navigation.handleNavigationStateChange(navState);
    progress.updateProgress(navState.url);
  };

  // Full-screen/immersive mode is only for the actual reading experience -
  // chapter/page URLs - not while browsing the site itself (detail page,
  // chapter list, search, etc). Reuse the exact same classification every
  // adapter already provides for extraction gating, rather than inventing a
  // second "is this a reading page" check that could drift out of sync
  // with it.
  const isReadingPage = !!metadataService
    .getExtractorForUrl(navigation.currentUrl || websiteUrl)
    ?.isChapterPage(navigation.currentUrl || websiteUrl);

  // Chrome auto-hide while reading. The header floats OVER the page (see
  // the layout below) rather than pushing it down, so hiding it just means
  // sliding it up out of the way - the page underneath never reflows.
  // Two triggers only, deliberately simple: it hides itself 2s after a page
  // finishes loading, and the reader brings it back by tapping near the top
  // of the screen (see the tap-catcher rendered below, only while hidden).
  // None of this applies outside a reading page - the header just stays put
  // there, same as any normal browser chrome.
  const headerHeight = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headerVisible, setHeaderVisibleState] = useState(true);

  const setHeaderVisible = (show: boolean) => {
    setHeaderVisibleState(show);
    Animated.timing(headerTranslateY, {
      toValue: show ? 0 : -(headerHeight.current || 120),
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const armHideTimer = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHeaderVisible(false), 2000);
  };

  const handleRevealTap = () => {
    setHeaderVisible(true);
    armHideTimer();
  };

  // Re-arm whenever a page finishes loading (navigation.loading true -> false)
  // - a fresh chapter/page load should always start from "visible, then hide
  // in 2s" rather than staying hidden from a previous page.
  useEffect(() => {
    if (!isReadingPage) {
      // Not a reading page - the chrome just stays visible, no timer.
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      setHeaderVisible(true);
      return;
    }
    if (!navigation.loading) {
      setHeaderVisible(true);
      armHideTimer();
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation.loading, isReadingPage]);

  // Hide the Android system nav bar, but only while actually on a reading
  // page - it eats into the same vertical space this whole redesign is
  // trying to reclaim there, but hiding it while the reader is browsing the
  // site itself (detail page, chapter list, ...) would just be disorienting
  // for no benefit. 'overlay-swipe' still lets an edge-swipe reveal it
  // temporarily if needed. iOS has no JS-controllable equivalent.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (isReadingPage) {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    } else {
      NavigationBar.setVisibilityAsync('visible');
    }
  }, [isReadingPage]);

  // Safety net: whatever state the nav bar was left in, always restore it
  // to visible when leaving this screen entirely, regardless of whether the
  // reader happened to be mid-chapter (isReadingPage true) at that moment.
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('visible');
      };
    }, [])
  );

  // Some anti-bot challenges (Cloudflare included) call window.open() as
  // part of their verification flow, or to test whether popups are being
  // blocked (a common headless/automation signal). With
  // setSupportMultipleWindows disabled, that call silently fails, which can
  // stall the challenge. We allow it, and just load the target URL in the
  // same WebView instead of spawning a real second window.
  const handleOpenWindow = (event: { nativeEvent: { targetUrl?: string } }) => {
    const targetUrl = event.nativeEvent?.targetUrl;
    // Ad networks are the other big source of window.open() calls (popunders,
    // "new tab" interstitials) - don't let those hijack the reader. Anything
    // else (e.g. Cloudflare's challenge probe) still gets rerouted in-place.
    if (targetUrl && !isAdUrl(targetUrl)) {
      webViewRef.current?.injectJavaScript(
        `window.location.href = ${JSON.stringify(targetUrl)}; true;`
      );
    }
  };

  // Refuse top-level/frame navigation to known ad/tracker domains outright -
  // this catches redirect-based ad interstitials that don't go through
  // window.open() at all.
  const handleShouldStartLoad = (request: { url: string }) => {
    return !isAdUrl(request.url);
  };

  // Handle "+ Library" button click
  const handleAddToLibrary = async () => {
    if (!navigation.currentUrl) return;

    // Check this FIRST, before anything else: if this screen was opened for
    // an existing library entry (e.g. "Continue Reading" from the library
    // list, which opens straight into a chapter URL - see home.tsx's
    // handleOpenManga, which passes both mangaId and userMangaId in that
    // case), the manga is already in the library. There's nothing to add,
    // regardless of whether we're on a chapter page or the detail page, and
    // regardless of whether cached metadata happens to be present. Showing
    // the add-to-library overlay here would offer to create a duplicate
    // entry; showing the "please open the detail page" warning would be
    // actively wrong, since the user did nothing wrong - the manga simply
    // isn't addable because it's already there.
    if (userMangaId) {
      showToast('This manga is already in your library', 'info');
      return;
    }

    // Check this next, before the detail-page gate below: if metadata was
    // already captured (e.g. while browsing the series page before tapping
    // into a chapter to read), it's valid regardless of what kind of page
    // we're currently sitting on - this is the common "read a chapter, then
    // add to library" flow and must not be blocked by the chapter-page check.
    if (metadata.extractedMetadata?.title) {
      setShowOverlay(true);
      return;
    }

    // No cached metadata - extraction only works on an actual detail page
    // (MetadataService intentionally refuses to extract on chapter pages).
    if (!metadataService.isMangaDetailPage(navigation.currentUrl)) {
      showToast('Please open the manga\'s detail page to add it to your library', 'warning');
      return;
    }

    // Extract metadata manually
    console.log('[Browser] Manually extracting metadata...');
    const success = await metadata.extractMetadata(navigation.currentUrl, true);
    
    if (success) {
      // Wait a bit for the message, then show overlay or alert
      setTimeout(() => {
        if (metadata.extractedMetadata?.title) {
          setShowOverlay(true);
        } else {
          showToast('Could not extract manga information. Please try again.', 'error');
        }
      }, 1000);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.gutter }}>
      <StatusBar hidden={isReadingPage} animated backgroundColor={colors.gutter} />

      {/* WebView fills the whole screen - the chrome below floats OVER it
          rather than pushing it down, so hiding the chrome while reading
          doesn't reflow the page underneath. */}
      <WebView
        ref={webViewRef}
        source={{
          uri: websiteUrl,
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        // navState.loading (handled in handleNavigationStateChange) is the
        // source of truth for the spinner - see useWebViewNavigation. Only
        // onLoadStart is used here, purely for snappier UI feedback the
        // instant a real navigation begins; it's never relied on to clear
        // the spinner, so it can't cause the stuck-spinner desync that
        // onLoadStart/onLoadEnd pairing was prone to on SPA-style pages.
        onLoadStart={() => navigation.setLoading(true)}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onMessage={metadata.handleWebViewMessage}
        injectedJavaScriptBeforeContentLoaded={AD_BLOCK_INJECTED_JS}
        javaScriptEnabled
        domStorageEnabled
        userAgent={MOBILE_USER_AGENT}
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled
        incognito={false}
        setSupportMultipleWindows
        onOpenWindow={handleOpenWindow}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback
      />

      {/* Loading Indicator */}
      {navigation.loading && (
        <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20, zIndex: 5 }}>
          <ActivityIndicator size="large" color={websiteColor} />
        </View>
      )}

      {/* Tap-near-top reveal catcher: invisible, only present while the
          chrome is hidden (so it never steals a touch meant for the
          header's own buttons once they're back on screen). */}
      {!headerVisible && (
        <TouchableOpacity
          onPress={handleRevealTap}
          activeOpacity={1}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, zIndex: 8 }}
        />
      )}

      {/* Reader chrome: one compact row (nav controls, an address "pill",
          and the library action) instead of the two stacked rows this used
          to be - plus the auto-hide behavior above. The source's own colour
          still runs as a thin rule under it. */}
      <Animated.View
        onLayout={(e) => {
          headerHeight.current = e.nativeEvent.layout.height;
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: colors.panel,
          transform: [{ translateY: headerTranslateY }],
        }}
      >
        <View
          style={{
            // Slim while actually reading (immersive), but tall enough to
            // clear the status bar the rest of the time, since that's
            // visible again outside a reading page.
            paddingTop: isReadingPage ? 12 : 44,
            paddingBottom: 10,
            paddingHorizontal: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.85}
              style={{
                width: 36,
                height: 36,
                backgroundColor: colors.panelRaised,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 7,
              }}
            >
              <Ionicons name="arrow-back" size={18} color={colors.paper} />
            </TouchableOpacity>

            {[
              { icon: 'chevron-back' as const, onPress: navigation.handleBack, enabled: navigation.canGoBack },
              { icon: 'chevron-forward' as const, onPress: navigation.handleForward, enabled: navigation.canGoForward },
            ].map((control) => (
              <TouchableOpacity
                key={control.icon}
                onPress={control.onPress}
                disabled={!control.enabled}
                activeOpacity={0.85}
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: colors.panelRaised,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 7,
                  opacity: control.enabled ? 1 : 0.35,
                }}
              >
                <Ionicons name={control.icon} size={18} color={colors.paper} />
              </TouchableOpacity>
            ))}

            {/* Address "pill": just the site name, tap to refresh - standing
                in for the two separate stacked lines plus a whole extra row
                of controls this used to take. */}
            <TouchableOpacity
              onPress={navigation.handleRefresh}
              activeOpacity={0.85}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                height: 36,
                backgroundColor: colors.panelRaised,
                paddingHorizontal: 12,
                marginRight: 7,
              }}
            >
              <Ionicons name="refresh" size={16} color={colors.toneDim} style={{ marginRight: 6 }} />
              <Text style={[type.title, { fontSize: 13, flex: 1 }]} numberOfLines={1}>
                {websiteName}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                bypassBackGuardRef.current = true;
                router.replace('/(main)/home');
              }}
              activeOpacity={0.85}
              style={{
                width: 36,
                height: 36,
                backgroundColor: colors.panelRaised,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 7,
              }}
              accessibilityLabel="Back to Library"
            >
              <Ionicons name="home-outline" size={18} color={colors.paper} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAddToLibrary}
              activeOpacity={0.85}
              style={{
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: userMangaId ? colors.panelRaised : colors.accent,
              }}
              accessibilityLabel={userMangaId ? 'Already in library' : 'Add to library'}
            >
              <Ionicons
                name={userMangaId ? 'checkmark' : 'add'}
                size={19}
                color={userMangaId ? colors.tone : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 3, backgroundColor: websiteColor }} />
      </Animated.View>

      {/* Reader Overlay */}
      <ReaderOverlay
        visible={showOverlay}
        metadata={metadata.extractedMetadata}
        currentUrl={navigation.currentUrl}
        onClose={() => setShowOverlay(false)}
        onSuccess={(newUserMangaId) => {
          setShowOverlay(false);
          metadata.clearMetadata();
          setUserMangaId(newUserMangaId);
        }}
      />

      {/* Toast Notifications */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </View>
  );
}
