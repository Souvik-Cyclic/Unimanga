import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

/**
 * ManhuaPlus Adapter
 *
 * Supports: https://manhuaplus.org/manga/[slug]
 *
 * NOTE (2026-08, live-verified): manhuaplus.com is a stale/parked WordPress
 * shell (Yoast SEO boilerplate, content last modified 2023, no working manga
 * listing/detail routes). The actual live site is manhuaplus.org - it sits
 * behind Cloudflare as a CDN only (no interactive JS challenge), and
 * `curl -sL` returns a clean 200 with fully server-rendered HTML containing
 * real manga content, no client JS execution required. Series/detail pages
 * live at `/manga/[slug]` and chapter pages at `/manga/[slug]/chapter-[n]`
 * (chapter number directly in the URL - confirmed working, e.g.
 * https://manhuaplus.org/manga/apotheosis/chapter-1301 returns 200). This
 * means the base `isChapterPage()`/`extractChapterNumber()` URL-regex
 * handling already covers this site; no DOM-based chapter-number script is
 * needed (unlike WeebCentral's opaque ULID chapter IDs).
 *
 * JSON-LD reality check: the site emits multiple `application/ld+json`
 * blocks (Organization, WebSite, ImageObject, WebPage - all nested inside a
 * single `@graph` array - plus a separate top-level `Article` block). Only
 * title and description are usefully present there:
 *   - Article.headline / WebPage.name -> clean title (e.g. "Apotheosis")
 *   - Article.description -> full synopsis (WebPage.description is
 *     truncated with a trailing "...")
 * There is NO genre/author/status data in JSON-LD, and Article.image points
 * at a bogus placeholder URL (`https://manhuaplus.org/cover`), not the real
 * cover - so cover/author/genre/status must all come from meta tags/DOM.
 *
 * Site conventions observed on a live detail page:
 *   - <title> / og:title follow the fixed pattern
 *     "Read {Title} Fastest and highest quality updates" (same shape as the
 *     og:description, which is just the site's boilerplate blurb, not a
 *     real synopsis - so og:description is NOT used for description here).
 *   - Cover image: og:image meta, or `figure.grid img[alt]` in the DOM,
 *     pointing at `/uploads/covers/[slug].jpg`.
 *   - Author: `#extra-info .y6x11p` containing "Authors", value in the
 *     nested `.dt` span (often literally "Updating" when unknown - the same
 *     placeholder pattern this adapter treats as "no author").
 *   - Status: `.y6x11p` containing "Status" -> `.dt` text (seen live as
 *     "OnGoing"); other values (Completed/Hiatus/Dropped/Cancelled) inferred
 *     from the same template and defensively matched via keyword scan.
 *   - Genres: `a[href*="/genres/"]` tag chips in the article body (distinct
 *     from the much larger sitewide genre-filter dropdown list, which is
 *     excluded by only reading genre links inside the article/header area).
 *     ManhuaPlus is manhua-focused and the genre chips already include a
 *     literal "Manhua" tag on manhua content in practice, but a defensive
 *     format-tag fallback (Manga/Manhwa/Manhua detection, mirroring
 *     MangaFireAdapter's hardening) is added in case a given title's genre
 *     chips omit it.
 */
export class ManhuaPlusAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'ManhuaPlus';
  }

  getUrlPatterns(): RegExp[] {
    return [
      /manhuaplus\.org/i,
    ];
  }

  isChapterPage(url: string): boolean {
    // Confirmed live URL shape: /manga/[slug]/chapter-[num]
    // Keep the base patterns too (ch/episode/ep/read) as a defensive fallback.
    return /\/manga\/[^/?#]+\/chapter-\d+/i.test(url) || super.isChapterPage(url);
  }

  isMangaDetailPage(url: string): boolean {
    // Confirmed live URL shape: /manga/[slug] (optionally with a trailing
    // slash and/or query string), e.g. https://manhuaplus.org/manga/apotheosis
    const isMangaPath = /\/manga\/[^/?#]+\/?(?:[?#].*)?$/i.test(url);
    return isMangaPath && !this.isChapterPage(url);
  }

  getChapterUrl(seriesUrl: string, chapterNumber: string): string | null {
    // Flat /manga/[slug]/chapter-N scheme (see isChapterPage above).
    const match = seriesUrl.match(/\/manga\/([^/?#]+)/i);
    const origin = seriesUrl.match(/^https?:\/\/[^/]+/i);
    if (!match || !origin) return null;
    return `${origin[0]}/manga/${match[1]}/chapter-${chapterNumber}`;
  }

  getInjectionScript(): string {
    return `
      (function() {
        try {
          const data = {};

          // Layer 0: JSON-LD structured data. ManhuaPlus emits several
          // application/ld+json blocks - Organization/WebSite/ImageObject
          // nested under a single @graph array, plus a separate top-level
          // Article block. Flatten arrays/@graph nesting so we don't miss
          // entries just because they're wrapped differently than expected.
          let ldTitle = '';
          let ldDescription = '';
          try {
            const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

            const flattenLdEntry = (entry) => {
              if (!entry || typeof entry !== 'object') return [];
              if (Array.isArray(entry)) {
                return entry.reduce((acc, e) => acc.concat(flattenLdEntry(e)), []);
              }
              if (Array.isArray(entry['@graph'])) {
                return entry['@graph'].reduce((acc, e) => acc.concat(flattenLdEntry(e)), []);
              }
              return [entry];
            };

            const parsed = ldScripts
              .map(s => {
                try {
                  return JSON.parse((s.textContent || '').trim());
                } catch (e) {
                  return null;
                }
              })
              .filter(Boolean)
              .reduce((acc, p) => acc.concat(flattenLdEntry(p)), [])
              .filter(p => p && typeof p === 'object' && typeof p['@type'] === 'string');

            // Article has the full (non-truncated) description; WebPage's
            // description is truncated with a trailing "...". Prefer Article,
            // fall back to WebPage.
            const article = parsed.find(p => p['@type'] === 'Article');
            const webpage = parsed.find(p => p['@type'] === 'WebPage');

            if (article) {
              ldTitle = String(article.headline || '').trim();
              ldDescription = String(article.description || '').trim();
            }
            if (!ldTitle && webpage) {
              ldTitle = String(webpage.name || '').trim();
            }
            if (!ldDescription && webpage) {
              ldDescription = String(webpage.description || '').trim();
            }
            // NOTE: deliberately NOT reading ld.image here - Article.image on
            // this site points at a bogus placeholder (/cover), not the real
            // per-manga cover. Cover comes from meta/DOM below instead.
          } catch (e) {
            ldTitle = '';
            ldDescription = '';
          }

          // A title that's just the site's own brand/name or a generic
          // placeholder is worse than no title: it looks like a successful
          // extraction but is garbage that would get cached against the
          // wrong manga and silently stop the staggered retry loop.
          const isGenericBrandTitle = (t) => {
            if (!t) return true;
            const normalized = t.trim().toLowerCase().replace(/[\\s\\-_|:]+/g, ' ').trim();
            if (!normalized) return true;
            return [
              'manhuaplus', 'manhua plus', 'manhua-plus', 'home', 'loading',
              '404', 'not found', 'read manga', 'manga', 'manhua', 'search',
            ].includes(normalized);
          };

          // Title: JSON-LD first, then h1, then og:title/document.title
          // (both follow the fixed template
          // "Read {Title} Fastest and highest quality updates").
          let title = '';
          try {
            if (ldTitle && !isGenericBrandTitle(ldTitle)) {
              title = ldTitle;
            }
          } catch (e) {}

          if (!title) {
            try {
              const h1Els = Array.from(document.querySelectorAll('h1'));
              const h1Text = h1Els
                .map(el => (el.textContent || '').trim())
                .filter(t => t && !isGenericBrandTitle(t))
                .reduce((longest, current) => current.length > longest.length ? current : longest, '');
              if (h1Text) title = h1Text;
            } catch (e) {}
          }

          if (!title) {
            try {
              const readTitlePattern = /^Read\\s+(.+?)\\s+Fastest/i;
              const metaTitle = document.querySelector('meta[property="og:title"]');
              const metaTitleText = metaTitle && metaTitle.content ? metaTitle.content.trim() : '';
              const metaMatch = metaTitleText.match(readTitlePattern);
              const candidate = metaMatch ? metaMatch[1].trim() : metaTitleText;
              if (candidate && !isGenericBrandTitle(candidate)) {
                title = candidate;
              }
            } catch (e) {}
          }

          if (!title) {
            try {
              const readTitlePattern = /^Read\\s+(.+?)\\s+Fastest/i;
              const docTitle = document.title || '';
              const docMatch = docTitle.match(readTitlePattern);
              const candidate = docMatch ? docMatch[1].trim() : docTitle.split('-')[0].trim();
              if (candidate && !isGenericBrandTitle(candidate)) {
                title = candidate;
              }
            } catch (e) {}
          }

          data.title = title;

          // Description
          let description = '';
          try {
            if (ldDescription) {
              description = ldDescription;
            }
          } catch (e) {}

          if (!description) {
            try {
              const descEl = document.querySelector('#syn-target') ||
                            document.querySelector('[class*="summary"]') ||
                            document.querySelector('[class*="description"]');
              if (descEl) {
                description = (descEl.textContent || '').trim();
              }
            } catch (e) {}
          }

          if (!description) {
            // og:description on this site is just the sitewide boilerplate
            // blurb ("Manhuaplus, Read manga, manhua, manhwa..."), so only
            // fall back to it as an absolute last resort.
            try {
              const metaDesc = document.querySelector('meta[property="og:description"]') ||
                              document.querySelector('meta[name="description"]');
              if (metaDesc && metaDesc.content) {
                description = metaDesc.content.trim();
              }
            } catch (e) {}
          }

          data.description = description.substring(0, 500);

          // Cover image
          try {
            let coverUrl = '';
            const metaImg = document.querySelector('meta[property="og:image"]');
            if (metaImg && metaImg.content) {
              coverUrl = metaImg.content;
            }
            if (!coverUrl) {
              const coverEl = document.querySelector('figure img[src*="/uploads/covers/"]') ||
                             document.querySelector('img[src*="/uploads/covers/"]') ||
                             document.querySelector('figure img');
              if (coverEl && coverEl.src) {
                coverUrl = coverEl.src;
              }
            }
            data.coverImage = coverUrl;
          } catch (e) {
            data.coverImage = '';
          }

          // Author
          try {
            let author = '';
            const infoRows = Array.from(document.querySelectorAll('.y6x11p, [class*="extra-info"] div'));
            const authorRow = infoRows.find(el => /author/i.test((el.textContent || '')));
            if (authorRow) {
              const link = authorRow.querySelector('a');
              const dt = authorRow.querySelector('.dt');
              const raw = (link ? link.textContent : (dt ? dt.textContent : '')) || '';
              const trimmed = raw.trim();
              if (trimmed && trimmed.toLowerCase() !== 'updating') {
                author = trimmed;
              }
            }
            if (!author) {
              const authorLink = document.querySelector('a[href*="/authors/"]');
              if (authorLink) {
                const trimmed = (authorLink.textContent || '').trim();
                if (trimmed && trimmed.toLowerCase() !== 'updating') {
                  author = trimmed;
                }
              }
            }
            data.author = author;
          } catch (e) {
            data.author = '';
          }

          // Genres (+ Manhua/Manhwa/Manga format-tag fallback)
          try {
            let genres = [];
            const genreLinks = document.querySelectorAll('a[href*="/genres/"]');
            genres = Array.from(new Set(
              Array.from(genreLinks)
                .map(el => (el.textContent || '').trim())
                .filter(Boolean)
            )).slice(0, 10);

            const hasFormatTag = genres.some(g => /^(manga|manhwa|manhua)$/i.test(g));
            if (!hasFormatTag) {
              genres = ['Manhua', ...genres];
            }

            data.genres = genres.length > 0 ? genres : ['Manhua'];
          } catch (e) {
            data.genres = ['Manhua'];
          }

          // Status
          try {
            let statusText = '';
            const infoRows = Array.from(document.querySelectorAll('.y6x11p, [class*="extra-info"] div'));
            const statusRow = infoRows.find(el => /status/i.test((el.textContent || '')));
            if (statusRow) {
              const dt = statusRow.querySelector('.dt');
              statusText = ((dt ? dt.textContent : statusRow.textContent) || '').trim().toLowerCase();
            }

            if (!statusText) {
              const statusKeywords = ['ongoing', 'completed', 'hiatus', 'dropped', 'cancelled', 'canceled'];
              const candidates = Array.from(document.querySelectorAll('span, div, p'));
              const match = candidates.find(el => {
                const text = (el.textContent || '').trim().toLowerCase();
                return text.length < 20 && statusKeywords.includes(text);
              });
              statusText = match ? (match.textContent || '').trim().toLowerCase() : '';
            }

            if (statusText.includes('ongoing')) data.mangaStatus = 'ongoing';
            else if (statusText.includes('completed')) data.mangaStatus = 'completed';
            else if (statusText.includes('hiatus')) data.mangaStatus = 'hiatus';
            else if (statusText.includes('dropped') || statusText.includes('cancel')) data.mangaStatus = 'cancelled';
            else data.mangaStatus = 'ongoing';
          } catch (e) {
            data.mangaStatus = 'ongoing';
          }

          data.sourceUrl = window.location.href.split('?')[0];
          data.sourceWebsite = 'ManhuaPlus';

          console.log('ManhuaPlus extraction:', {
            title: data.title,
            titleLength: data.title ? data.title.length : 0,
            hasDescription: !!data.description,
            hasCover: !!data.coverImage,
            genresCount: data.genres ? data.genres.length : 0
          });

          return JSON.stringify(data);
        } catch(e) {
          console.log('ManhuaPlus extraction error:', e);
          return JSON.stringify({ error: e.message });
        }
      })();
    `;
  }
}
