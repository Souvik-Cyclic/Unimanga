import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

/**
 * Comizy Adapter
 *
 * Supports: https://comizy.io/[slug] (detail), https://comizy.io/[slug]/chapter-[num] (chapter)
 *
 * NOTE (2026-08): Comizy.io was formerly known as MangaBuddy - mangabuddy.com
 * now 301-redirects to comizy.io and PRESERVES the path (verified live:
 * https://mangabuddy.com/accidental-baby -> https://comizy.io/accidental-baby),
 * so mangabuddy.com is kept in getUrlPatterns() as a defensive fallback for
 * old bookmarked/shared links, even though the WebView will end up navigating
 * to the comizy.io URL once the redirect resolves.
 *
 * Site sits behind Cloudflare as a CDN only - no interactive JS challenge.
 * Pages are Next.js SSR and arrive as full server-rendered HTML (verified via
 * plain curl, no browser JS execution required for the content to appear).
 *
 * Extraction layers (in priority order):
 *  1. Next.js hydration payload (`<script id="__NEXT_DATA__">`), specifically
 *     `props.pageProps.initialManga`. This is the richest and most reliable
 *     source - it's the exact same object the React page renders from, and
 *     includes name/altNames/summary/cover/status/authors[]/artists[]/genres[].
 *     JSON-LD on this site is a bare `BreadcrumbList` (verified live) with no
 *     manga-specific schema type (no ComicSeries/Book), so it's only used as
 *     a last-resort title source (the breadcrumb's own page name, which is
 *     already clean of the " - Comizy" title suffix) - not a primary layer.
 *  2. Meta tags (og:title/og:description/og:image), stripping the
 *     " - Comizy" / " - Chapter N - Comizy" suffix Comizy appends to <title>.
 *  3. DOM selector cascade (h1, author/genre link lists, status badge text,
 *     cover <img>) as the final fallback if the above ever change shape.
 *
 * Each field is extracted in its own try/catch so one broken layer can't
 * sink the whole result (the same hardening AsuraScansAdapter uses, after a
 * single broken selector took down all of WeebCentralAdapter's extraction).
 */
export class ComizyAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'Comizy';
  }

  getUrlPatterns(): RegExp[] {
    return [
      /comizy\.io/i,
      // Legacy domain - 301-redirects to comizy.io preserving the path, kept
      // as a defensive fallback for old MangaBuddy links.
      /mangabuddy\.com/i,
    ];
  }

  isChapterPage(url: string): boolean {
    // Verified chapter URL shape: /[slug]/chapter-[num], where sub-chapters
    // use a second dash-joined segment instead of a decimal point, e.g.
    //   https://comizy.io/accidental-baby/chapter-31
    //   https://comizy.io/a-midnight-bellboy/chapter-6-5
    //   https://comizy.io/hasugaya-kun-likes-to-make-people-cry/chapter-8-3
    return /\/[^/?#]+\/chapter-\d+(?:-\d+)?\/?(?:[?#].*)?$/i.test(url) || super.isChapterPage(url);
  }

  isMangaDetailPage(url: string): boolean {
    if (!this.canHandle(url)) return false;
    if (this.isChapterPage(url)) return false;

    // Verified detail URL shape: a single top-level path segment on the
    // domain root, e.g. https://comizy.io/accidental-baby
    // A bunch of real site sections live at that same depth though (nav
    // links, legal pages, auth, etc.) - verified live from comizy.io's own
    // homepage/latest page markup - so those have to be excluded explicitly,
    // otherwise every one of them would falsely look like a manga slug.
    const reservedPaths = new Set([
      '', 'home', 'about', 'contact', 'dmca', 'latest', 'search', 'terms',
      'terms-of-service', 'privacy-policy', 'genres', 'ranking', 'lists',
      'hall-of-fame', 'discussions', 'trending', 'authors', 'tags', 'auth',
      'api', 'static', '_next', 'sitemap', 'bookmarks', 'history',
      'settings', 'profile', 'login', 'register', 'favicon.ico', 'manifest',
    ]);

    const match = url.match(/^https?:\/\/[^/]+\/([^/?#]+)\/?(?:[?#].*)?$/i);
    if (!match) return false;

    const firstSegment = decodeURIComponent(match[1]).toLowerCase();
    return !reservedPaths.has(firstSegment);
  }

  getChapterUrl(seriesUrl: string, chapterNumber: string): string | null {
    // Flat /[slug]/chapter-N scheme (see isChapterPage above) - the slug is
    // just the detail URL's single path segment.
    const match = seriesUrl.match(/^https?:\/\/[^/]+\/([^/?#]+)\/?(?:[?#].*)?$/i);
    if (!match) return null;
    const origin = seriesUrl.match(/^https?:\/\/[^/]+/i);
    if (!origin) return null;
    return `${origin[0]}/${match[1]}/chapter-${chapterNumber}`;
  }

  getInjectionScript(): string {
    return `
      (function() {
        try {
          const data = {};

          // Comizy's site brand/placeholder names - never accept these as a
          // real manga title, at any layer of the extraction cascade below.
          // A title that resolves to just the brand name LOOKS like a
          // successful extraction (non-empty string) but is garbage that
          // would get cached against the wrong manga and silently stop the
          // staggered retry loop from trying again once real content loads.
          const isGenericBrandTitle = (t) => {
            if (!t) return true;
            const normalized = t.trim().toLowerCase().replace(/[\\s\\-_|:]+/g, ' ').trim();
            if (!normalized) return true;
            return [
              'comizy', 'comizy io', 'comizy.io', 'home', 'loading',
              'latest', 'search', '404', 'not found', 'error',
            ].includes(normalized);
          };

          // Layer 0: Next.js hydration payload. This is the exact object the
          // React page renders from (props.pageProps.initialManga), so it's
          // the richest and most reliable source available - richer than the
          // JSON-LD on this site, which is just a bare BreadcrumbList with no
          // manga-specific schema type.
          let manga = null;
          try {
            const nextDataEl = document.getElementById('__NEXT_DATA__');
            if (nextDataEl && nextDataEl.textContent) {
              const nextData = JSON.parse(nextDataEl.textContent);
              const pageProps = nextData && nextData.props && nextData.props.pageProps;
              if (pageProps && pageProps.initialManga && typeof pageProps.initialManga === 'object') {
                manga = pageProps.initialManga;
              }
            }
          } catch (e) {
            manga = null;
          }

          // Layer 0b: JSON-LD BreadcrumbList - last-resort title source only
          // (the manga's own breadcrumb entry name, already clean of the
          // " - Comizy" suffix Comizy appends to <title>/og:title).
          let breadcrumbTitle = '';
          try {
            const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const s of ldScripts) {
              try {
                const parsed = JSON.parse((s.textContent || '').trim());
                if (parsed && parsed['@type'] === 'BreadcrumbList' && Array.isArray(parsed.itemListElement)) {
                  const items = parsed.itemListElement.slice().sort((a, b) => (a.position || 0) - (b.position || 0));
                  // Skip the first ("Home") crumb; the manga's own crumb is
                  // the second one on both detail and chapter pages.
                  const mangaCrumb = items[1];
                  if (mangaCrumb && mangaCrumb.name) {
                    breadcrumbTitle = String(mangaCrumb.name).trim();
                  }
                  break;
                }
              } catch (e) {
                // Not this script block - keep looking.
              }
            }
          } catch (e) {
            breadcrumbTitle = '';
          }

          // Title
          let title = '';
          try {
            if (manga && manga.name) {
              const ldTitle = String(manga.name).trim();
              if (!isGenericBrandTitle(ldTitle)) title = ldTitle;
            }
            if (!title && breadcrumbTitle && !isGenericBrandTitle(breadcrumbTitle)) {
              title = breadcrumbTitle;
            }
            if (!title) {
              const metaTitle = document.querySelector('meta[property="og:title"]') ||
                               document.querySelector('meta[name="title"]');
              const metaTitleText = metaTitle && metaTitle.content ? metaTitle.content.trim() : '';
              // og:title on this site is "<Manga Name> - Comizy" (or
              // "<Manga Name> - Chapter N - Comizy" on chapter pages) - strip
              // everything from the first " - " onward.
              const stripped = metaTitleText.split(' - ')[0].trim();
              if (!isGenericBrandTitle(stripped)) title = stripped;
            }
            if (!title) {
              const h1 = document.querySelector('h1');
              const h1Text = h1 ? h1.textContent.trim() : '';
              if (!isGenericBrandTitle(h1Text)) title = h1Text;
            }
            if (!title) {
              const docTitle = document.title.split(' - ')[0].trim();
              if (!isGenericBrandTitle(docTitle)) title = docTitle;
            }
          } catch (e) {
            // Leave title as '' - MetadataService's "if (!data.title)" check
            // correctly treats that as "not ready yet" and retries.
          }
          data.title = title;

          // Description
          let description = '';
          try {
            if (manga && manga.summary) {
              description = String(manga.summary).trim();
            }
            if (!description) {
              const metaDesc = document.querySelector('meta[property="og:description"]') ||
                              document.querySelector('meta[name="description"]');
              if (metaDesc && metaDesc.content) description = metaDesc.content.trim();
            }
            if (!description) {
              const candidates = Array.from(document.querySelectorAll('p'));
              const longP = candidates.find(p => p.textContent && p.textContent.trim().length > 80);
              if (longP) description = longP.textContent.trim();
            }
          } catch (e) {
            description = '';
          }
          data.description = description.substring(0, 500);

          // Cover image
          let coverImage = '';
          try {
            if (manga && manga.cover) {
              coverImage = String(manga.cover);
            }
            if (!coverImage) {
              const metaImg = document.querySelector('meta[property="og:image"]');
              if (metaImg && metaImg.content) coverImage = metaImg.content;
            }
            if (!coverImage) {
              const images = Array.from(document.querySelectorAll('img'));
              const coverEl = images.find(img =>
                img.alt && title && img.alt.trim().toLowerCase() === title.toLowerCase() &&
                !img.src.includes('logo')
              ) || images.find(img =>
                !img.src.includes('logo') && !img.src.startsWith('data:') &&
                img.src.includes('/covers/')
              );
              if (coverEl) coverImage = coverEl.src;
            }
          } catch (e) {
            coverImage = '';
          }
          data.coverImage = coverImage;

          // Author / artist
          let author = '';
          try {
            if (manga) {
              const authorList = Array.isArray(manga.authors) ? manga.authors : [];
              const artistList = Array.isArray(manga.artists) ? manga.artists : [];
              const names = authorList.length > 0 ? authorList : artistList;
              author = names.map(a => (a && a.name) ? a.name : '').filter(Boolean).join(', ');
            }
            if (!author) {
              const authorEls = document.querySelectorAll('a[href*="/authors/"]');
              author = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean).join(', ');
            }
          } catch (e) {
            author = '';
          }
          data.author = author;

          try {
            if (manga && Array.isArray(manga.artists) && manga.artists.length > 0) {
              data.artist = manga.artists.map(a => (a && a.name) ? a.name : '').filter(Boolean).join(', ');
            }
          } catch (e) {
            // artist stays undefined - optional field.
          }

          // Genres
          let genres = [];
          try {
            if (manga && Array.isArray(manga.genres)) {
              genres = manga.genres.map(g => (g && g.name) ? g.name : '').filter(Boolean);
            }
            if (genres.length === 0) {
              const genreEls = document.querySelectorAll('a[href*="/genres/"]');
              genres = Array.from(genreEls).map(el => el.textContent.trim()).filter(Boolean);
            }
          } catch (e) {
            genres = [];
          }
          data.genres = Array.from(new Set(genres)).slice(0, 8);

          // Status - Comizy's own data uses "Ongoing"/"Completed"/"Hiatus"/
          // "Cancelled" (verified live: 'Ongoing' and 'Completed' seen on
          // real pages); the rendered status badge instead shows all-caps UI
          // labels like "RELEASING"/"COMPLETED", so both forms are checked.
          try {
            let statusText = '';
            if (manga && manga.status) {
              statusText = String(manga.status).toLowerCase();
            }
            if (!statusText) {
              const badge = Array.from(document.querySelectorAll('span')).find(el => {
                const t = (el.textContent || '').trim().toLowerCase();
                return ['releasing', 'ongoing', 'completed', 'hiatus', 'cancelled', 'canceled', 'dropped'].includes(t);
              });
              statusText = badge ? badge.textContent.trim().toLowerCase() : '';
            }

            if (statusText.includes('releasing') || statusText.includes('ongoing')) data.mangaStatus = 'ongoing';
            else if (statusText.includes('completed')) data.mangaStatus = 'completed';
            else if (statusText.includes('hiatus')) data.mangaStatus = 'hiatus';
            else if (statusText.includes('cancel') || statusText.includes('dropped')) data.mangaStatus = 'cancelled';
            else data.mangaStatus = 'ongoing';
          } catch (e) {
            data.mangaStatus = 'ongoing';
          }

          // Alternative titles
          try {
            if (manga && Array.isArray(manga.altNames)) {
              const alts = manga.altNames.map(a => (a && a.name) ? a.name : '').filter(Boolean);
              if (alts.length > 0) data.alternativeTitles = Array.from(new Set(alts)).slice(0, 10);
            }
          } catch (e) {
            // alternativeTitles stays undefined - optional field.
          }

          data.sourceUrl = window.location.href.split('?')[0];
          data.sourceWebsite = 'Comizy';

          console.log('Comizy extraction:', {
            title: data.title,
            titleLength: data.title.length,
            hasDescription: !!data.description,
            hasCover: !!data.coverImage,
            genresCount: data.genres.length
          });

          return JSON.stringify(data);
        } catch(e) {
          console.log('Comizy extraction error:', e);
          return JSON.stringify({ error: e.message });
        }
      })();
    `;
  }
}
