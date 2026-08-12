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
