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
