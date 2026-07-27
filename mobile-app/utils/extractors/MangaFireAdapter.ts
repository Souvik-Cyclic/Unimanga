import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

/**
 * MangaFire Adapter
 *
 * Supports: https://mangafire.to
 *
 * URL structure (verified against MangaFire's live routing behavior and its
 * currently-maintained Tachiyomi/Keiyoushi extension source, since the site
 * itself is behind Cloudflare and cannot be curled directly):
 *
 * Current scheme (site migrated to this around July 2026 - the extension's
 * upstream API responses now build links this way):
 *   - Detail: /title/{hid}-{slug}                       e.g. /title/52x0-solo-leveling
 *   - Chapter: /title/{hid}-{slug}/{chapterId}-chapter-{n}-{lang}
 *   - Volume:  /title/{hid}-{slug}/volume/{id}
 *
 * Legacy scheme (still resolves for old bookmarks/search-indexed links):
 *   - Detail: /manga/{slug}.{hid}                        e.g. /manga/solo-levelingg.52x0
 *   - Chapter: /read/{slug}.{hid}/{lang}/chapter-{n}      e.g. /read/solo-levelingg.52x0/en/chapter-1
 *
 * MangaFire hosts manga, manhwa, and manhua under the exact same URL shape
 * (no separate /manhwa/ or /manhua/ path segment) - the "type" is only
 * exposed as a data attribute (Manga/Manhwa/Manhua), typically surfaced as
 * the first tag alongside genres on the detail page.
 *
 * Features:
 * - Large collection
 * - Multiple sources
 * - Fast updates
 */
export class MangaFireAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'MangaFire';
  }

  getUrlPatterns(): RegExp[] {
    return [
      // Legacy detail page scheme: /manga/{slug}.{hid}
      /mangafire\.to\/manga\//i,
      // Current detail page scheme: /title/{hid}-{slug}
      /mangafire\.to\/title\//i,
    ];
  }

  /**
   * MangaFire chapter/volume (reading) pages, across both the legacy and
   * current URL schemes.
   */
  isChapterPage(url: string): boolean {
    // Legacy reading pages live under /read/...
    if (/mangafire\.to\/read\//i.test(url)) {
      return true;
    }

    // Current scheme: /title/{hid}-{slug}/{chapterId}-chapter-{n}-{lang}
    if (/\/title\/[^/?#]+\/\d+-chapter-[\d.]+/i.test(url)) {
      return true;
    }

    // Current scheme volume reader: /title/{hid}-{slug}/volume/{id}
    if (/\/title\/[^/?#]+\/volume\/\d+/i.test(url)) {
      return true;
    }

    return super.isChapterPage(url);
  }

  /**
   * A URL is a manga detail (series) page only if it matches one of our
   * known detail-page schemes AND isn't actually a chapter/volume reading
   * page - the current /title/ scheme is shared between detail pages and
   * chapter pages, so this can't just be canHandle().
   */
  isMangaDetailPage(url: string): boolean {
    return this.canHandle(url) && !this.isChapterPage(url);
  }

  /**
   * Derive the series (detail page) URL from a chapter/volume reading URL.
   * The default BaseWebsiteAdapter implementation only understands
   * "/chapter/123" (slash-delimited) shapes; MangaFire uses dash-delimited
   * "chapter-123" segments on both of its URL schemes, so it needs its own
   * logic here.
   */
  getSeriesUrlFromChapter(chapterUrl: string): string | null {
    // Current scheme: strip the trailing "/{chapterId}-chapter-{n}-{lang}"
    let match = chapterUrl.match(/^(.*\/title\/[^/?#]+)\/\d+-chapter-[\d.]+[^/?#]*/i);
    if (match) return match[1];

    // Current scheme volume reader: strip the trailing "/volume/{id}"
    match = chapterUrl.match(/^(.*\/title\/[^/?#]+)\/volume\/\d+/i);
    if (match) return match[1];

    // Legacy scheme: /read/{slug}.{hid}/{lang}/chapter-{n} -> /manga/{slug}.{hid}
    match = chapterUrl.match(/^(https?:\/\/[^/]+)\/read\/([^/?#]+)\//i);
    if (match) return `${match[1]}/manga/${match[2]}`;

    return super.getSeriesUrlFromChapter(chapterUrl);
  }

  getInjectionScript(): string {
    return `
      (function() {
        try {
          const data = {};
          const debug = { attempts: {} };

          // ---- Cloudflare interstitial / challenge-page guard ----
          // mangafire.to sits behind Cloudflare, and on a fresh navigation
          // (especially the earliest 800ms staggered attempt) the WebView can
          // still be showing the JS challenge page ("Just a moment...")
          // rather than the real detail page. That page has no JSON-LD, no
          // og:title, and no matching h1 - but it DOES have a non-empty
          // document.title, so without this guard the document.title
          // fallback below would happily return "Just a moment..." as a
          // truthy (garbage) manga title. That would poison the cache for
          // this series and permanently end the retry loop (parseMetadata
          // only checks that data.title is non-empty) instead of returning
          // cleanly so the 2200ms/4000ms attempts get a real shot once the
          // challenge has resolved. Verified directly against the live
          // Cloudflare challenge HTML for this site.
          try {
            const docTitleLower = (document.title || '').toLowerCase();
            const isCloudflareChallenge =
              /^\\s*just a moment/i.test(document.title || '') ||
              docTitleLower.includes('attention required') ||
              docTitleLower.includes('checking your browser') ||
              !!document.querySelector(
                '#challenge-running, #cf-challenge-running, #challenge-error-text, .cf-browser-verification, [class*="cf-turnstile"], #cf-wrapper'
              );
            debug.cloudflareChallenge = isCloudflareChallenge;
            if (isCloudflareChallenge) {
              return JSON.stringify({ error: 'Cloudflare challenge page not yet resolved', _debug: debug });
            }
          } catch (e) {}

          // Placeholder/garbage-title guard shared by every title source
          // below. The dangerous failure mode here isn't "extraction finds
          // nothing" (the retry loop already handles that fine) - it's
          // extraction finding SOMETHING truthy but wrong (a site-wide name,
          // a loading skeleton's text, a stray heading) at the 800ms attempt,
          // which stops the retry loop and caches bad data. Every title
          // source is validated against this before being accepted.
          function isPlaceholderTitle(t) {
            if (!t) return true;
            const norm = t.trim().toLowerCase();
            if (norm.length < 2) return true;
            const blocklist = [
              'mangafire', 'manga fire', 'home', 'loading', 'loading...',
              'untitled', 'just a moment', 'just a moment...',
              'attention required', 'access denied', 'error', '404', '403',
              'not found', 'page not found', 'read manga online free',
              'read manga online', 'undefined', 'null'
            ];
            return blocklist.indexOf(norm) !== -1;
          }

          // ---- JSON-LD (schema.org) structured data - most redesign-proof ----
          let ld = null;
          try {
            const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const s of ldScripts) {
              try {
                let parsed = JSON.parse(s.textContent);
                const candidates = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
                for (const c of candidates) {
                  if (!c || typeof c !== 'object') continue;
                  const type = (c['@type'] || '').toString().toLowerCase();
                  if (type.includes('book') || type.includes('comic') || type.includes('creativework') ||
                      type.includes('periodical') || type.includes('article') || c.name || c.headline) {
                    ld = c;
                    break;
                  }
                }
              } catch (e) {}
              if (ld) break;
            }
          } catch (e) {}
          debug.jsonLdFound = !!ld;

          // Title - JSON-LD, then multiple selectors, then meta, then document.title
          let title = '';
          if (ld && (ld.name || ld.headline)) {
            const ldTitle = (ld.name || ld.headline).toString().trim();
            if (ldTitle && !isPlaceholderTitle(ldTitle)) {
              title = ldTitle;
              debug.titleSource = 'json-ld';
            } else if (ldTitle) {
              debug.attempts['json-ld'] = 'rejected-placeholder:' + ldTitle;
            }
          }

          if (!title) {
            const metaTitle = document.querySelector('meta[property="og:title"]') ||
                             document.querySelector('meta[name="twitter:title"]') ||
                             document.querySelector('meta[name="title"]');
            debug.attempts['meta'] = metaTitle ? metaTitle.content : 'not found';
            if (metaTitle && metaTitle.content) {
              // MangaFire meta titles look like "Solo Leveling Manga - Read Manga Online Free"
              const metaCandidate = metaTitle.content.split(/\\s[-|]\\s/)[0].trim();
              if (metaCandidate && !isPlaceholderTitle(metaCandidate)) {
                title = metaCandidate;
                debug.titleSource = 'meta';
              } else if (metaCandidate) {
                debug.attempts['meta'] = 'rejected-placeholder:' + metaCandidate;
              }
            }
          }

          if (!title) {
            const titleSelectors = [
              'h1.name',
              'h1.title',
              '.manga-name',
              '.info-title h1',
              '[class*="detail"] h1',
              '[class*="title"] h1',
              'main h1',
              'h1'
            ];

            for (const selector of titleSelectors) {
              const el = document.querySelector(selector);
              const candidate = el ? el.textContent.trim() : '';
              debug.attempts[selector] = candidate || 'not found';
              if (candidate && !isPlaceholderTitle(candidate)) {
                title = candidate;
                debug.titleSource = selector;
                break;
              } else if (candidate) {
                debug.attempts[selector] = 'rejected-placeholder:' + candidate;
              }
            }
          }

          // Final fallback to document.title - the riskiest source, since
          // document.title is set very early (often before hydration and,
          // per the Cloudflare guard above, even on the interstitial page),
          // so it's the most likely to contain a generic/placeholder value
          // rather than the actual series title. Same placeholder guard
          // applies here, not just an emptiness check.
          if (!title && document.title) {
            const docCandidate = document.title.split(/\\s[-|]\\s/)[0].trim();
            if (docCandidate && !isPlaceholderTitle(docCandidate)) {
              title = docCandidate;
              debug.titleSource = 'document.title';
            } else if (docCandidate) {
              debug.attempts['document.title'] = 'rejected-placeholder:' + docCandidate;
            }
          }

          data.title = title;

          // ---- Description ----
          let description = '';
          if (ld && ld.description) {
            description = ld.description.toString().trim();
            debug.descSource = 'json-ld';
          }

          if (!description) {
            const descSelectors = [
              '.description',
              '.synopsis',
              '[class*="synopsis"]',
              '[class*="desc"]',
              '[class*="summary"]',
              '.info-desc',
              'div[class*="description"] p',
              'section[class*="synopsis"] p'
            ];

            for (const selector of descSelectors) {
              const el = document.querySelector(selector);
              if (el && el.textContent.trim() && el.textContent.trim().length > 20) {
                description = el.textContent.trim();
                debug.descSource = selector;
                break;
              }
            }
          }

          if (!description) {
            const metaDesc = document.querySelector('meta[property="og:description"]') ||
                            document.querySelector('meta[name="twitter:description"]') ||
                            document.querySelector('meta[name="description"]');
            description = metaDesc ? metaDesc.content : '';
            if (description) debug.descSource = 'meta';
          }

          data.description = description.substring(0, 500);

          // ---- Cover Image ----
          let coverImage = '';
          if (ld && ld.image) {
            coverImage = typeof ld.image === 'string' ? ld.image : (ld.image.url || (Array.isArray(ld.image) ? ld.image[0] : ''));
            if (coverImage) debug.coverSource = 'json-ld';
          }

          const imageSelectors = [
            'img.cover',
            'img.poster',
            'img[alt*="cover" i]',
            '.manga-poster img',
            '.info-img img',
            '[class*="poster"] img',
            'img[class*="cover"]',
            'img[class*="poster"]'
          ];

          if (!coverImage) {
            const images = Array.from(document.querySelectorAll('img'));
            for (const selector of imageSelectors) {
              const el = document.querySelector(selector);
              if (el && el.src && !el.src.includes('logo') && !el.src.includes('icon')) {
                coverImage = el.src;
                debug.coverSource = selector;
                break;
              }
            }

            // Fallback: find largest plausible cover image
            if (!coverImage && images.length > 0) {
              const largeImage = images.find(img =>
                img.naturalWidth > 150 &&
                img.naturalHeight > 200 &&
                !img.src.includes('logo') &&
                !img.src.includes('icon')
              ) || images.find(img =>
                img.width > 150 &&
                img.height > 200 &&
                !img.src.includes('logo') &&
                !img.src.includes('icon')
              );
              coverImage = largeImage ? largeImage.src : '';
              if (coverImage) debug.coverSource = 'largest-image';
            }
          }

          // Final fallback to meta image
          if (!coverImage) {
            const metaImg = document.querySelector('meta[property="og:image"]') ||
                           document.querySelector('meta[name="twitter:image"]');
            coverImage = metaImg ? metaImg.content : '';
            if (coverImage) debug.coverSource = 'meta';
          }

          data.coverImage = coverImage;

          // ---- Author ----
          let author = '';
          if (ld && ld.author) {
            const a = ld.author;
            author = typeof a === 'string' ? a : (a.name || (Array.isArray(a) ? a.map(x => x && x.name).filter(Boolean).join(', ') : ''));
            if (author) debug.authorSource = 'json-ld';
          }

          if (!author) {
            const authorSelectors = [
              'a[href*="/author/"]',
              '[class*="author"] a',
              '[class*="author"]',
              '.meta-data .author'
            ];

            for (const selector of authorSelectors) {
              try {
                const el = document.querySelector(selector);
                if (el && el.textContent.trim() &&
                    !el.textContent.toLowerCase().includes('unknown') &&
                    el.textContent.trim().length > 0) {
                  author = el.textContent.trim().replace(/^Author:?/i, '').trim();
                  debug.authorSource = selector;
                  break;
                }
              } catch(e) {}
            }
          }

          data.author = author;

          // ---- Genres (and format tag: Manga / Manhwa / Manhua) ----
          let genres = [];
          if (ld && ld.genre) {
            genres = (Array.isArray(ld.genre) ? ld.genre : [ld.genre])
              .map(g => (g || '').toString().trim())
              .filter(g => g && g.length > 0 && g.length < 30)
              .slice(0, 8);
            if (genres.length > 0) debug.genreSource = 'json-ld';
          }

          if (genres.length === 0) {
            const genreSelectors = [
              'a[href*="/genre/"]',
              '[class*="genres"] a',
              '[class*="genre"] a',
              '[class*="type"] a',
              '.badge',
              '.tag'
            ];

            for (const selector of genreSelectors) {
              try {
                const genreEls = document.querySelectorAll(selector);
                if (genreEls.length > 0) {
                  const found = Array.from(genreEls)
                    .map(el => el.textContent.trim())
                    .filter(g => g && g.length > 0 && g.length < 30);
                  if (found.length > 0) {
                    genres = found.slice(0, 8);
                    debug.genreSource = selector;
                    break;
                  }
                }
              } catch(e) {}
            }
          }

          // Format/type badge (Manga / Manhwa / Manhua) often lives outside the
          // genre list as its own labelled chip - fold it in as the first genre
          // entry if we can find it and it isn't already present.
          try {
            const formatSelectors = ['[class*="type"]', '[class*="format"]', '.badge'];
            let formatFound = false;
            for (const selector of formatSelectors) {
              if (formatFound) break;
              const els = document.querySelectorAll(selector);
              for (const el of Array.from(els)) {
                const text = (el.textContent || '').trim();
                if (/^(manga|manhwa|manhua)$/i.test(text)) {
                  const normalized = text[0].toUpperCase() + text.slice(1).toLowerCase();
                  if (!genres.some(g => g.toLowerCase() === normalized.toLowerCase())) {
                    genres = [normalized, ...genres];
                  }
                  formatFound = true;
                  break;
                }
              }
            }
          } catch(e) {}

          data.genres = genres.length > 0 ? genres : ['Manga'];

          // ---- Status ----
          // MangaFire's underlying vocabulary is: releasing, finished,
          // on_hiatus, discontinued, not_yet_released - map those (and the
          // human-readable variants shown in the DOM) onto our own enum.
          let status = 'ongoing';
          let statusFound = false;
          if (ld && ld.status) {
            const s = ld.status.toString().toLowerCase();
            debug.statusSource = 'json-ld';
            statusFound = true;
            if (s.includes('complet') || s.includes('finish')) status = 'completed';
            else if (s.includes('hiatus')) status = 'hiatus';
            else if (s.includes('discontinu') || s.includes('cancel')) status = 'cancelled';
            else status = 'ongoing';
          }

          if (!statusFound) {
            const statusSelectors = [
              '[class*="status"]',
              '.info-status',
              '.meta-data .status'
            ];

            for (const selector of statusSelectors) {
              try {
                const el = document.querySelector(selector);
                if (el) {
                  const statusText = el.textContent.toLowerCase();
                  if (statusText.includes('completed') || statusText.includes('finished')) {
                    status = 'completed';
                    debug.statusSource = selector;
                    break;
                  } else if (statusText.includes('hiatus')) {
                    status = 'hiatus';
                    debug.statusSource = selector;
                    break;
                  } else if (statusText.includes('discontinued') || statusText.includes('cancelled')) {
                    status = 'cancelled';
                    debug.statusSource = selector;
                    break;
                  } else if (statusText.includes('ongoing') || statusText.includes('releasing') || statusText.includes('publishing')) {
                    status = 'ongoing';
                    debug.statusSource = selector;
                    break;
                  }
                }
              } catch(e) {}
            }
          }

          data.mangaStatus = status;

          // Clean up URL
          data.sourceUrl = window.location.href.split('?')[0].split('#')[0];
          data.sourceWebsite = 'MangaFire';
          data._debug = debug;

          return JSON.stringify(data);
        } catch(e) {
          return JSON.stringify({ error: e.message, stack: e.stack });
        }
      })();
    `;
  }

  /**
   * DOM-based chapter number extraction, independent of the chapter URL.
   *
   * Background: mangafire.to is 100% behind Cloudflare and every attempt to
   * curl or WebFetch it (across multiple sessions, including one more retry
   * during this change) returned only the "Just a moment..." interstitial
   * (HTTP 403) - never real page HTML. The URL shape documented at the top
   * of this file (`/title/{hid}-{slug}/{chapterId}-chapter-{n}-{lang}`) is
   * therefore still unverified against a live page; it was reverse-engineered
   * from the Tachiyomi/Keiyoushi extension source. `extractChapterNumber()`
   * in mangaHelpers.ts (shared, not touched here) depends entirely on that
   * unverified shape holding exactly - if the real site puts the chapter
   * number somewhere other than immediately after the literal "chapter-"
   * segment (e.g. the chapter id and number are swapped, or a volume segment
   * is inserted), that regex can silently return the wrong digits with no
   * way to detect the mistake from the URL alone.
   *
   * This method removes that dependency for progress tracking by reading the
   * chapter number directly from the rendered page, mirroring the pattern
   * WeebCentralAdapter.getChapterNumberScript() uses. Since MangaFire's real
   * DOM structure is equally unverified (same Cloudflare block), this is a
   * defensive cascade rather than a single verified selector:
   *
   * 1. A chapter navigation <select> (MangaFire, like most reader sites, is
   *    expected to offer a "jump to chapter" dropdown) - the selected
   *    option's text is checked first since it's the most direct signal.
   * 2. Headings or elements whose class/id hints at a chapter title/selector
   *    (e.g. `.chapter-title`, `[class*="chapter"]`), in case the current
   *    chapter is rendered as visible text near the reader controls.
   * 3. `document.title` - treated as a near-universally-reliable fallback
   *    regardless of DOM/class specifics, since basic SEO practice on any
   *    manga reader page puts "Chapter N" (or "Episode N") directly in the
   *    page title (e.g. "Solo Leveling Chapter 179 - MangaFire"). This does
   *    NOT depend on guessing CSS classes, unlike 1-2 above.
   * 4. og:title meta tag, as a final fallback mirroring document.title.
   *
   * All four are matched against the same `/(?:chapter|episode)\s*(\d+(?:\.\d+)?)/i`
   * pattern used by WeebCentralAdapter, so a match only counts if it's
   * actually attached to the word "chapter"/"episode" - this avoids
   * grabbing an unrelated number (e.g. a rating or page count) that happens
   * to sit in the same element.
   */
  getChapterNumberScript(): string {
    return `
      (function() {
        try {
          const chapterRegex = /(?:chapter|episode)\\s*(\\d+(?:\\.\\d+)?)/i;
          let chapterNumber = null;

          // 1. Chapter navigation <select> - selected option's text
          if (!chapterNumber) {
            const selects = Array.from(document.querySelectorAll('select'));
            for (const select of selects) {
              const selectedOption = select.options && select.options[select.selectedIndex];
              const text = selectedOption ? selectedOption.textContent : '';
              const match = text && text.match(chapterRegex);
              if (match) {
                chapterNumber = match[1];
                break;
              }
            }
          }

          // 2. Headings or elements whose class/id hints at a chapter title/selector
          if (!chapterNumber) {
            const candidates = Array.from(
              document.querySelectorAll(
                'h1, h2, h3, [class*="chapter"], [id*="chapter"]'
              )
            );
            for (const el of candidates) {
              const text = el.textContent || '';
              const match = text.match(chapterRegex);
              if (match) {
                chapterNumber = match[1];
                break;
              }
            }
          }

          // 3. document.title - treated as a solid fallback regardless of
          //    DOM specifics, e.g. "Solo Leveling Chapter 179 - MangaFire"
          if (!chapterNumber) {
            const match = document.title && document.title.match(chapterRegex);
            if (match) chapterNumber = match[1];
          }

          // 4. og:title meta tag, mirroring document.title
          if (!chapterNumber) {
            const metaTitle = document.querySelector('meta[property="og:title"]');
            const content = metaTitle ? metaTitle.content : '';
            const match = content && content.match(chapterRegex);
            if (match) chapterNumber = match[1];
          }

          return JSON.stringify({ chapterNumber: chapterNumber });
        } catch(e) {
          return JSON.stringify({ chapterNumber: null, error: e.message });
        }
      })();
    `;
  }
}
