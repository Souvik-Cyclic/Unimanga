import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

/**
 * AsuraScans Adapter
 *
 * Supports: https://asurascans.com/comics/[slug]
 *
 * NOTE (2026-08): asuracomic.net now permanently redirects (301) to
 * asurascans.com, and the site was restructured from the old
 * `/series/[slug]` URL scheme to `/comics/[slug]` for series/detail pages,
 * with chapters at `/comics/[slug]/chapter/[num]`. The old `/series/` path
 * no longer resolves to anything (redirects straight to the homepage), so
 * detail-page detection is now based on `/comics/` rather than `/series/`.
 * The legacy `/series/` pattern is kept as a defensive fallback in case a
 * mirror or older cached link still uses it.
 *
 * Features:
 * - Fast releases
 * - Popular manhwa and manga
 * - Community translations
 *
 * NOTE: This adapter includes complex DOM selection logic
 * to handle dynamically loaded content and avoid background images
 */
export class AsuraScansAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'AsuraScans';
  }

  getUrlPatterns(): RegExp[] {
    return [
      /asuracomic\.net/i,
      /asuratoon\.com/i,
      /asurascans\./i,
    ];
  }

  isChapterPage(url: string): boolean {
    // Current chapter URL shape: /comics/[slug]/chapter/[num]
    // Keep the base patterns too (ch/episode/ep/read) as a defensive fallback.
    return /\/comics\/[^/?#]+\/chapter\/\d+/i.test(url) || super.isChapterPage(url);
  }

  isMangaDetailPage(url: string): boolean {
    // Current series/detail URL shape: /comics/[slug] (optionally with a
    // trailing slash and/or query string), e.g.
    //   https://asurascans.com/comics/overgeared-b60d532c
    //   https://asurascans.com/comics/overgeared-b60d532c/?ref=home
    // The legacy /series/[slug] shape is kept as a fallback for old links.
    const isComicsOrSeriesPath = /\/(comics|series)\/[^/?#]+\/?(?:[?#].*)?$/i.test(url);
    return isComicsOrSeriesPath && !this.isChapterPage(url);
  }

  getInjectionScript(): string {
    // This is the WORKING extraction script from metadataExtractors.ts
    // Kept as-is to preserve functionality
    return `
      (function() {
        try {
          const data = {};

          // Layer 0: JSON-LD structured data (schema.org). This survives
          // CSS-class/DOM redesigns since it's semantic, not presentational.
          // AsuraScans (asurascans.com) emits multiple <script type="application/ld+json">
          // blocks on series pages - Organization, BreadcrumbList, Article, and
          // ComicSeries. The ComicSeries block has the richest, most reliable data
          // (name, description, image, genre[], author, illustrator), so prefer it;
          // fall back to a Book/CreativeWork/Article block if ComicSeries isn't present.
          let ld = null;
          try {
            const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

            // A single <script type="application/ld+json"> block can contain:
            //  - a plain object (most common on this site today)
            //  - a top-level array of objects: [{...}, {...}]
            //  - an object with the real entries nested under "@graph": {"@graph":[{...}]}
            // Flatten all of these into a single flat list of candidate objects so
            // we don't silently miss a ComicSeries block that IS present just because
            // it's nested/wrapped differently than expected.
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

            ld = parsed.find(p => p['@type'] === 'ComicSeries') ||
                 parsed.find(p => ['Book', 'CreativeWork', 'Article', 'Manga'].includes(p['@type']));
          } catch (e) {
            ld = null;
          }

          // Wait for content to load - try to find any h1 first
          const waitForContent = () => {
            const h1Elements = document.querySelectorAll('h1');
            const allText = Array.from(h1Elements).map(el => el.textContent.trim()).filter(t => t && t !== 'summary');
            
            // A title that is just the site's own brand/name (e.g. the WebView is
            // still showing a loading shell, or the document title hasn't been set
            // yet for this page) is worse than no title at all: it LOOKS like a
            // successful extraction (non-empty string) but is garbage data that
            // would get cached against the wrong manga and silently stop the
            // staggered retry loop. Reject anything that resolves to just the
            // brand name (with or without separators/whitespace) at every layer
            // of the cascade below.
            const isGenericBrandTitle = (t) => {
              if (!t) return true;
              const normalized = t.trim().toLowerCase().replace(/[\s\-_|:]+/g, ' ').trim();
              if (!normalized) return true;
              return [
                'asura scans', 'asurascans', 'asura toon', 'asuratoon',
                'asura', 'home', 'loading', 'comics', 'series',
              ].includes(normalized);
            };

            // Title - prefer JSON-LD (name/headline), then largest/most prominent h1
            let title = '';
            if (ld && (ld.name || ld.headline)) {
              const ldTitle = String(ld.name || ld.headline).trim();
              if (!isGenericBrandTitle(ldTitle)) {
                title = ldTitle;
              }
            }
            if (!title && allText.length > 0) {
              // Get the longest non-empty h1 that's not "summary"
              const h1Title = allText.reduce((longest, current) =>
                current.length > longest.length ? current : longest
              , '');
              if (!isGenericBrandTitle(h1Title)) {
                title = h1Title;
              }
            }

            // Fallback: try meta tags
            if (!title) {
              const metaTitle = document.querySelector('meta[property="og:title"]') ||
                               document.querySelector('meta[name="title"]');
              const metaTitleText = metaTitle && metaTitle.content ? metaTitle.content.trim() : '';
              // og:title on this site is "<Manga Name> | Asura Scans" - strip the
              // brand suffix the same way the document.title fallback below does,
              // then re-check for a bare brand-name result.
              const stripped = metaTitleText.split('|')[0].trim();
              if (!isGenericBrandTitle(stripped)) {
                title = stripped;
              }
            }

            // Fallback: try document title
            if (!title) {
              const docTitle = document.title.split('|')[0].split('-')[0].trim();
              if (!isGenericBrandTitle(docTitle)) {
                title = docTitle;
              }
            }

            // If every candidate resolved to a generic brand/placeholder value,
            // data.title stays '' - MetadataService.parseMetadata's "if (!data.title)"
            // check correctly treats that as "not ready yet" and the staggered
            // retry loop tries again at the next delay instead of caching garbage.
            data.title = title;
            
            // Description - try multiple approaches
            let description = '';

            // Prefer JSON-LD description first
            if (ld && ld.description) {
              description = String(ld.description).trim();
            }

            // Try meta description
            const metaDesc = document.querySelector('meta[property="og:description"]') ||
                            document.querySelector('meta[name="description"]');
            if (!description && metaDesc) {
              description = metaDesc.content;
            }
            
            // Try visible description elements
            if (!description) {
              const descEl = document.querySelector('.description') || 
                           document.querySelector('[class*="description"]') ||
                           document.querySelector('.summary') ||
                           document.querySelector('[class*="summary"]') ||
                           Array.from(document.querySelectorAll('p')).find(p => p.textContent.length > 100);
              description = descEl ? descEl.textContent.trim() : '';
            }
            
            data.description = description.substring(0, 500);
            
            // Cover Image - prefer JSON-LD image, then avoid logos and backgrounds in the DOM
            let ldImage = '';
            if (ld && ld.image) {
              ldImage = typeof ld.image === 'string' ? ld.image : (ld.image.url || '');
            }

            const images = Array.from(document.querySelectorAll('img'));
            let coverEl = images.find(img =>
              img.alt && (img.alt.toLowerCase().includes('cover') || img.alt.toLowerCase().includes(title.toLowerCase()))
            );

            if (!coverEl) {
              coverEl = images.find(img =>
                !img.src.includes('logo') &&
                !img.src.includes('bg.png') &&
                !img.src.includes('background') &&
                !img.src.includes('toraka-hero') &&
                img.width > 150 &&
                img.height > 200
              );
            }

            if (ldImage) {
              data.coverImage = ldImage;
            } else if (!coverEl || coverEl.src.includes('logo') || coverEl.src.includes('bg.png') || coverEl.src.includes('toraka-hero')) {
              // Try meta image
              const metaImg = document.querySelector('meta[property="og:image"]');
              if (metaImg && !metaImg.content.includes('logo') && !metaImg.content.includes('bg.png') && !metaImg.content.includes('toraka-hero')) {
                data.coverImage = metaImg.content;
              } else {
                data.coverImage = coverEl ? coverEl.src : '';
              }
            } else {
              data.coverImage = coverEl ? coverEl.src : '';
            }

            // Author - prefer JSON-LD (ComicSeries author, sometimes an object or array),
            // falling back to illustrator, then DOM selectors.
            let ldAuthor = '';
            if (ld) {
              const authorSrc = ld.author || ld.illustrator;
              if (Array.isArray(authorSrc)) {
                ldAuthor = authorSrc.map(a => (a && a.name) ? a.name : a).filter(Boolean).join(', ');
              } else if (authorSrc && typeof authorSrc === 'object') {
                ldAuthor = authorSrc.name || '';
              } else if (typeof authorSrc === 'string') {
                ldAuthor = authorSrc;
              }
            }

            if (ldAuthor) {
              data.author = ldAuthor.trim();
            } else {
              let authorEl = document.querySelector('a[href*="author"]') ||
                            document.querySelector('[class*="author"]');
              data.author = authorEl ? authorEl.textContent.trim() : '';
            }

            // Genres - prefer JSON-LD genre[]/articleSection, falling back to DOM selectors
            let ldGenres = [];
            if (ld) {
              if (Array.isArray(ld.genre)) {
                ldGenres = ld.genre;
              } else if (typeof ld.genre === 'string') {
                ldGenres = ld.genre.split(',').map(g => g.trim());
              } else if (typeof ld.articleSection === 'string') {
                ldGenres = ld.articleSection.split(',').map(g => g.trim());
              }
            }

            if (ldGenres.length > 0) {
              data.genres = Array.from(new Set(ldGenres.map(g => String(g).trim()).filter(Boolean))).slice(0, 5);
            } else {
              // NodeLists are always truthy (even when empty), so the "||" operator
              // between querySelectorAll() calls never actually falls through to the next
              // selector - pick the first selector that returns at least one match.
              const genreSelectors = ['a[href*="genre"]', '.genres a', '[class*="genre"] a'];
              let genreEls = [];
              for (const sel of genreSelectors) {
                const found = document.querySelectorAll(sel);
                if (found.length > 0) {
                  genreEls = found;
                  break;
                }
              }
              data.genres = Array.from(new Set(
                Array.from(genreEls)
                  .map(el => el.textContent.trim().replace(/,$/g, ''))
                  .filter(Boolean)
              )).slice(0, 5);
            }
            
            // Status - the current redesign no longer puts "status" in the class
            // name (e.g. it's now a bare span with just utility classes like
            // "text-base font-bold ... capitalize"), so fall back to scanning
            // short text nodes for a known status keyword if class selectors miss.
            let statusEl = document.querySelector('[class*="status"]') ||
                          document.querySelector('.post-status span');
            let statusText = statusEl ? statusEl.textContent.toLowerCase() : '';

            if (!statusText) {
              const statusKeywords = ['ongoing', 'completed', 'hiatus', 'dropped', 'cancelled', 'canceled'];
              const candidates = Array.from(document.querySelectorAll('span, div, p'));
              const match = candidates.find(el => {
                const text = (el.textContent || '').trim().toLowerCase();
                return text.length < 20 && statusKeywords.includes(text);
              });
              statusText = match ? match.textContent.trim().toLowerCase() : '';
            }

            if (statusText.includes('ongoing')) data.mangaStatus = 'ongoing';
            else if (statusText.includes('completed')) data.mangaStatus = 'completed';
            else if (statusText.includes('hiatus')) data.mangaStatus = 'hiatus';
            else if (statusText.includes('dropped') || statusText.includes('cancel')) data.mangaStatus = 'dropped';
            else data.mangaStatus = 'ongoing';
            
            data.sourceUrl = window.location.href.split('?')[0];
            data.sourceWebsite = 'AsuraScans';
            
            return data;
          };
          
          const result = waitForContent();
          
          // Debug logging
          console.log('AsuraScans extraction:', {
            title: result.title,
            titleLength: result.title.length,
            hasDescription: !!result.description,
            hasCover: !!result.coverImage,
            genresCount: result.genres.length
          });
          
          return JSON.stringify(result);
        } catch(e) {
          console.log('AsuraScans extraction error:', e);
          return JSON.stringify({ error: e.message });
        }
      })();
    `;
  }
}
