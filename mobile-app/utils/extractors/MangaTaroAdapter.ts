import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

/**
 * MangaTaro Adapter
 *
 * Supports: https://mangataro.org/manga/[slug] (detail),
 *           https://mangataro.org/read/[slug]/ch[num]-[chapterId] (chapter)
 *
 * Fully server-rendered, no Cloudflare challenge (verified via curl). Detail
 * pages emit a real schema.org `ComicSeries` JSON-LD block (name,
 * description, image, genre, author) - the richest and most reliable
 * source, same pattern AsuraScansAdapter uses. The chapter *list* itself is
 * loaded client-side via a tokened AJAX call (`/auth/manga-chapters`, an
 * MD5(timestamp + hour-bucketed secret) token - reverse-engineered from the
 * site's own bundled JS and confirmed live), but that's irrelevant here:
 * this adapter never needs to fetch the chapter list, only recognize a
 * chapter URL once the user has navigated to one via the site's own UI -
 * and the chapter number is right there in the URL (`ch244-700182`), no
 * token or extra request required for that.
 */
export class MangaTaroAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'MangaTaro';
  }

  getUrlPatterns(): RegExp[] {
    return [/mangataro\.org/i];
  }

  isChapterPage(url: string): boolean {
    // Verified chapter URL shape: /read/[slug]/ch[num]-[chapterId], e.g.
    //   https://mangataro.org/read/dandadan/ch244-700182
    return /\/read\/[^/?#]+\/ch\d+(?:\.\d+)?-\d+\/?(?:[?#].*)?$/i.test(url) || super.isChapterPage(url);
  }

  isMangaDetailPage(url: string): boolean {
    if (!this.canHandle(url)) return false;
    // Verified detail URL shape: /manga/[slug], e.g.
    //   https://mangataro.org/manga/dandadan
    // Distinct path prefix from /read/.../ (chapters), so no reserved-path
    // exclusion list is needed here.
    return /\/manga\/[^/?#]+\/?(?:[?#].*)?$/i.test(url);
  }

  getSeriesUrlFromChapter(chapterUrl: string): string | null {
    // The chapter path carries the same slug as the detail page (just under
    // /read/ instead of /manga/) - e.g. /read/dandadan/ch244-700182 ->
    // slug "dandadan" -> /manga/dandadan.
    const match = chapterUrl.match(/\/read\/([^/?#]+)\/ch\d+(?:\.\d+)?-\d+\/?(?:[?#].*)?$/i);
    if (!match) return null;
    const origin = chapterUrl.match(/^https?:\/\/[^/]+/i);
    if (!origin) return null;
    return `${origin[0]}/manga/${match[1]}`;
  }

  getInjectionScript(): string {
    return `
      (function() {
        try {
          const data = {};

          // MangaTaro's own brand/placeholder text - never accept these as
          // a real manga title (same hardening as the other adapters here).
          const isGenericBrandTitle = (t) => {
            if (!t) return true;
            const normalized = t.trim().toLowerCase().replace(/[\\s\\-_|:]+/g, ' ').trim();
            if (!normalized) return true;
            return ['mangataro', 'read manga online free', 'home', 'loading', 'manga'].includes(normalized);
          };

          // Layer 0: JSON-LD ComicSeries - the richest, most reliable source
          // on this site (name/description/image/genre/author), same as
          // AsuraScans. Fall back to Book/CreativeWork/Article if present.
          let ld = null;
          try {
            const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            const parsed = ldScripts
              .map(s => { try { return JSON.parse((s.textContent || '').trim()); } catch (e) { return null; } })
              .filter(p => p && typeof p === 'object' && typeof p['@type'] === 'string');
            ld = parsed.find(p => p['@type'] === 'ComicSeries') ||
                 parsed.find(p => ['Book', 'CreativeWork', 'Article', 'Manga'].includes(p['@type']));
          } catch (e) {
            ld = null;
          }

          // Title - prefer JSON-LD name, then h1, then meta/document title.
          // og:title on this site is "<Manga Name> Manga | Read Online Free at MangaTaro"
          // (verified live) - strip everything from the first " | " onward.
          let title = '';
          try {
            if (ld && ld.name) {
              const ldTitle = String(ld.name).split('|')[0].trim();
              if (!isGenericBrandTitle(ldTitle)) title = ldTitle;
            }
          } catch (e) {}
          if (!title) {
            try {
              const h1s = Array.from(document.querySelectorAll('h1'))
                .map(el => el.textContent.trim())
                .filter(t => t && !isGenericBrandTitle(t));
              if (h1s.length > 0) {
                title = h1s.reduce((longest, cur) => cur.length > longest.length ? cur : longest, '');
              }
            } catch (e) {}
          }
          if (!title) {
            try {
              const metaTitle = document.querySelector('meta[property="og:title"]');
              const metaTitleText = metaTitle && metaTitle.content ? metaTitle.content.trim() : '';
              const stripped = metaTitleText.split('|')[0].trim();
              if (!isGenericBrandTitle(stripped)) title = stripped;
            } catch (e) {}
          }
          if (!title) {
            try {
              const docTitle = document.title.split('|')[0].trim();
              if (!isGenericBrandTitle(docTitle)) title = docTitle;
            } catch (e) {}
          }
          data.title = title;

          // Description
          let description = '';
          try {
            if (ld && ld.description) description = String(ld.description).trim();
          } catch (e) {}
          if (!description) {
            try {
              const metaDesc = document.querySelector('meta[property="og:description"]') ||
                              document.querySelector('meta[name="description"]');
              if (metaDesc && metaDesc.content) description = metaDesc.content.trim();
            } catch (e) {}
          }
          if (!description) {
            try {
              const descEl = document.getElementById('description-container') ||
                            document.querySelector('[class*="description"]');
              if (descEl) description = descEl.textContent.trim();
            } catch (e) {}
          }
          data.description = description.substring(0, 500);

          // Cover image
          try {
            if (ld && ld.image) {
              data.coverImage = typeof ld.image === 'string' ? ld.image : (ld.image.url || '');
            }
          } catch (e) {}
          if (!data.coverImage) {
            try {
              const metaImg = document.querySelector('meta[property="og:image"]');
              if (metaImg && metaImg.content) data.coverImage = metaImg.content;
            } catch (e) {}
          }

          // Author - JSON-LD author, falling back to a DOM link/selector.
          try {
            if (ld && ld.author) {
              const a = ld.author;
              if (Array.isArray(a)) {
                data.author = a.map(x => (x && x.name) ? x.name : x).filter(Boolean).join(', ');
              } else if (a && typeof a === 'object') {
                data.author = a.name || '';
              } else if (typeof a === 'string') {
                data.author = a;
              }
            }
          } catch (e) {}
          if (!data.author) {
            try {
              const authorEl = document.querySelector('a[href*="/author/"]') || document.querySelector('[class*="author"]');
              if (authorEl) data.author = authorEl.textContent.trim();
            } catch (e) {}
          }

          // Genres - JSON-LD genre[], falling back to genre links.
          try {
            let genres = [];
            if (ld && Array.isArray(ld.genre)) {
              genres = ld.genre;
            } else if (ld && typeof ld.genre === 'string') {
              genres = ld.genre.split(',').map(g => g.trim());
            }
            if (genres.length === 0) {
              const genreEls = document.querySelectorAll('a[href*="/genre/"]');
              genres = Array.from(genreEls).map(el => el.textContent.trim());
            }
            data.genres = Array.from(new Set(genres.map(g => String(g).trim()).filter(Boolean))).slice(0, 8);
          } catch (e) {
            data.genres = [];
          }

          // Status - scan short text nodes for a known status keyword, same
          // approach AsuraScansAdapter uses since there's no dedicated class.
          try {
            const statusKeywords = ['ongoing', 'completed', 'hiatus', 'dropped', 'cancelled', 'canceled'];
            const candidates = Array.from(document.querySelectorAll('span, div, p'));
            const match = candidates.find(el => {
              const text = (el.textContent || '').trim().toLowerCase();
              return text.length < 20 && statusKeywords.includes(text);
            });
            const statusText = match ? match.textContent.trim().toLowerCase() : '';

            if (statusText.includes('ongoing')) data.mangaStatus = 'ongoing';
            else if (statusText.includes('completed')) data.mangaStatus = 'completed';
            else if (statusText.includes('hiatus')) data.mangaStatus = 'hiatus';
            else if (statusText.includes('dropped') || statusText.includes('cancel')) data.mangaStatus = 'cancelled';
            else data.mangaStatus = 'ongoing';
          } catch (e) {
            data.mangaStatus = 'ongoing';
          }

          data.sourceUrl = window.location.href.split('?')[0];
          data.sourceWebsite = 'MangaTaro';

          console.log('MangaTaro extraction:', {
            title: data.title,
            titleLength: data.title.length,
            hasDescription: !!data.description,
            hasCover: !!data.coverImage,
            genresCount: data.genres.length
          });

          return JSON.stringify(data);
        } catch(e) {
          console.log('MangaTaro extraction error:', e);
          return JSON.stringify({ error: e.message });
        }
      })();
    `;
  }
}
