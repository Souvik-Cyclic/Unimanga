/**
 * Ad blocking for the in-app WebView reader.
 *
 * Two layers, same as a browser extension:
 * 1. Network-level: refuse to navigate to known ad/tracker domains at all
 *    (WebView's onShouldStartLoadWithRequest + a window.open() domain check).
 * 2. Cosmetic: hide leftover ad containers/iframes that already loaded
 *    (common class/id patterns), kept up to date via a MutationObserver
 *    since ad slots are frequently injected after initial page load.
 *
 * This is a small hardcoded list, not a full EasyList - good enough to kill
 * the most common ad networks manga sites embed (popunders, banner networks,
 * interstitials) without needing a bundled filter-list dependency.
 */

const AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'adservice.google.com',
  'adnxs.com',
  'adsystem.com',
  'amazon-adsystem.com',
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'propellerclick.com',
  'exoclick.com',
  'exosrv.com',
  'juicyads.com',
  'adsterra.com',
  'a-ads.com',
  'revcontent.com',
  'taboola.com',
  'outbrain.com',
  'criteo.com',
  'criteo.net',
  'moatads.com',
  'scorecardresearch.com',
  'adsafeprotected.com',
  'adroll.com',
  'media.net',
  'bidvertiser.com',
  'clicksor.com',
  'yllix.com',
  'adcash.com',
  'trafficjunky.net',
  'mgid.com',
  'smartadserver.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'contextweb.com',
  'casalemedia.com',
  'zedo.com',
  'chartboost.com',
  'adition.com',
  'onclickmega.com',
  'onclicksuper.com',
  'highperformanceformat.com',
  'displayvertising.com',
];

/** Returns true if the URL's host matches (or is a subdomain of) a known ad/tracker domain. */
export function isAdUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return AD_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    // Not a parseable absolute URL (e.g. about:blank, data:) - let it through,
    // it's not something an ad domain check applies to.
    return false;
  }
}

/**
 * Injected before the page's own scripts run (injectedJavaScriptBeforeContentLoaded),
 * so ad slots are hidden/blocked as early as possible instead of flashing in
 * before being removed.
 */
export const AD_BLOCK_INJECTED_JS = `
  (function() {
    try {
      var adDomains = ${JSON.stringify(AD_DOMAINS)};
      var isAdHost = function(host) {
        host = (host || '').toLowerCase();
        for (var i = 0; i < adDomains.length; i++) {
          var d = adDomains[i];
          if (host === d || host.slice(-(d.length + 1)) === '.' + d) return true;
        }
        return false;
      };

      // Fake "Click Allow if you are not a robot" overlays are a well-known
      // push-notification-permission scam creative served by ad networks -
      // they exist purely to get the site (or a malicious ad iframe) a
      // Notification.requestPermission() grant, which then gets used to spam
      // OS-level notification ads. There's no legitimate reason a manga
      // reader page needs this permission, so auto-deny it outright - this
      // starves the scam overlay's actual goal even where it isn't caught by
      // the domain/selector blocking below (e.g. injected inline by a
      // compromised ad slot on the site's own origin, not a third-party
      // iframe).
      if (window.Notification) {
        try {
          Object.defineProperty(window.Notification, 'requestPermission', {
            value: function() { return Promise.resolve('denied'); },
            configurable: true,
          });
        } catch (e) {}
      }

      // Block window.open() to ad domains outright (popunders/popups), let
      // everything else through unchanged (needed for Cloudflare's own
      // window.open probe, handled natively in browser.tsx's onOpenWindow).
      var nativeOpen = window.open;
      window.open = function(url) {
        try {
          if (url && isAdHost(new URL(url, window.location.href).hostname)) {
            return null;
          }
        } catch (e) {}
        return nativeOpen.apply(window, arguments);
      };

      // Cosmetic filtering: hide common ad container patterns.
      var AD_SELECTORS = [
        '[class*="ad-container" i]', '[class*="ad-banner" i]', '[class*="ad-slot" i]',
        '[class*="advertisement" i]', '[id*="ad-container" i]', '[id*="google_ads" i]',
        '[class*="adsbygoogle" i]', 'ins.adsbygoogle',
        'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
        'iframe[src*="adnxs"]', 'iframe[src*="popads"]', 'iframe[src*="exoclick"]',
        '[class^="ad-" i]', '[class$="-ad" i]', '[class*=" ad " i]',
        '[data-ad-slot]', '[data-ad-client]',
      ].join(',');

      var style = document.createElement('style');
      style.textContent = AD_SELECTORS + ' { display: none !important; visibility: hidden !important; height: 0 !important; }';
      (document.head || document.documentElement).appendChild(style);

      var hideAds = function() {
        try {
          document.querySelectorAll(AD_SELECTORS).forEach(function(el) {
            el.style.setProperty('display', 'none', 'important');
          });
        } catch (e) {}
      };

      // Structural detection for fake "click Allow if you are not a robot"
      // scam overlays: these are a common ad-network creative whose real
      // goal is a Notification.requestPermission() grant (already
      // auto-denied above) or a malware/redirect click-through. Their class
      // names are often obfuscated/randomized so substring matching above
      // won't catch them, but their SHAPE is consistent: a fixed-position
      // element covering most of the viewport, high z-index (sits above
      // page content), containing wording like "robot"/"captcha"/"human"/
      // "click allow". That combination is a strong, low-false-positive
      // signature regardless of class-name obfuscation.
      var SCAM_TEXT_PATTERN = /robot|captcha|verify.*human|click allow|are you human|e-captcha/i;

      // Real CAPTCHA/anti-bot challenge widgets (Cloudflare Turnstile,
      // reCAPTCHA, hCaptcha) legitimately use the exact same wording
      // ("verify you are human", "are you human") and the exact same shape
      // (a fixed/high-z-index box) as the fake scam overlays this is meant
      // to catch - there is no text-content heuristic that can tell a real
      // Cloudflare challenge apart from a scam creative impersonating one.
      // Many sites in this app (AsuraScans included) sit behind Cloudflare,
      // so hiding the real widget here would silently swallow it: the
      // challenge can never be completed, the origin page never serves, and
      // nothing downstream (including on-demand metadata extraction) ever
      // gets a real page to run against - with no error, since from the
      // page's perspective everything "worked", it's just invisible.
      // Skip anything that IS or CONTAINS a recognized real-challenge
      // widget instead of hiding it.
      var CHALLENGE_SELECTOR = '.cf-turnstile, #challenge-stage, #challenge-running, ' +
        '#challenge-form, .g-recaptcha, .h-captcha, [data-sitekey], ' +
        'iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"], ' +
        'iframe[src*="recaptcha"], iframe[src*="hcaptcha.com"]';

      var hideScamOverlays = function(roots) {
        try {
          var vw = window.innerWidth, vh = window.innerHeight;
          // Scanning every element under <body> on every single mutation is
          // O(n) work (plus a forced layout per element via innerText/
          // getBoundingClientRect) per mutation - on a page with frequent
          // DOM churn (lazy-loaded image grids, infinite scroll) this adds
          // up fast and can starve the main thread of time to run anything
          // else queued on it, including a later on-demand injectJavaScript
          // call. Prefer scanning just the nodes that were actually added
          // this batch (that's where a newly-injected overlay would be);
          // only fall back to a full-document scan for the very first call
          // (roots undefined), where there's nothing "added" to diff against yet.
          var candidates;
          if (roots && roots.length) {
            var seen = [];
            for (var r = 0; r < roots.length; r++) {
              var root = roots[r];
              if (root.nodeType !== 1) continue;
              seen.push(root);
              var nested = root.querySelectorAll ? root.querySelectorAll('*') : [];
              for (var j = 0; j < nested.length; j++) seen.push(nested[j]);
            }
            candidates = seen;
          } else {
            candidates = document.querySelectorAll('body *');
          }

          // Hard cap so a pathological page (thousands of nodes added in
          // one batch) can't turn this into a multi-second synchronous scan.
          var MAX_SCAN = 500;
          var limit = Math.min(candidates.length, MAX_SCAN);
          for (var i = 0; i < limit; i++) {
            var el = candidates[i];
            var text = el.innerText || '';
            if (text.length > 300 || !SCAM_TEXT_PATTERN.test(text)) continue;

            var style = window.getComputedStyle(el);
            if (style.position !== 'fixed' && style.position !== 'sticky') continue;
            var zIndex = parseInt(style.zIndex, 10);
            if (!(zIndex > 999)) continue;

            var rect = el.getBoundingClientRect();
            var coverage = (rect.width * rect.height) / (vw * vh);
            if (coverage < 0.5) continue;

            // Never hide a real challenge widget mistaken for a scam overlay.
            if (el.matches && el.matches(CHALLENGE_SELECTOR)) continue;
            if (el.querySelector && el.querySelector(CHALLENGE_SELECTOR)) continue;

            el.style.setProperty('display', 'none', 'important');
          }
        } catch (e) {}
      };

      // Coalesce bursts of mutations (e.g. a large lazy-loaded image grid,
      // or infinite-scroll pagination appending dozens of nodes at once)
      // into at most one hide pass per animation frame, instead of running
      // the full hideAds()/hideScamOverlays() pass synchronously for every
      // individual MutationObserver callback invocation - a hot page can
      // otherwise fire this dozens of times a second.
      var pendingRoots = [];
      var scheduled = false;
      var flush = function() {
        scheduled = false;
        var roots = pendingRoots;
        pendingRoots = [];
        hideAds();
        hideScamOverlays(roots);
      };
      var schedule = function(roots) {
        if (roots && roots.length) {
          for (var i = 0; i < roots.length; i++) pendingRoots.push(roots[i]);
        }
        if (scheduled) return;
        scheduled = true;
        var raf = window.requestAnimationFrame || function(cb) { return setTimeout(cb, 16); };
        raf(flush);
      };

      var start = function() {
        hideAds();
        hideScamOverlays();
        var observer = new MutationObserver(function(mutations) {
          var added = [];
          for (var m = 0; m < mutations.length; m++) {
            var nodes = mutations[m].addedNodes;
            for (var n = 0; n < nodes.length; n++) added.push(nodes[n]);
          }
          schedule(added);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
      } else {
        start();
      }
    } catch (e) {}
  })();
  true;
`;
