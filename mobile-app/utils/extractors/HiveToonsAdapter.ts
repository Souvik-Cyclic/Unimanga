import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

/**
 * HiveToons Adapter
 *
 * Supports: https://hivetoons.org/series/[slug] (detail),
 *           https://hivetoons.org/series/[slug]/chapter-[num] (chapter)
 *
 * Fully server-rendered Astro site - no Cloudflare challenge, verified live
 * via plain curl. Metadata is right there in the raw HTML, no JS-wait /
 * hydration-delay concerns.
 *
 * Detail URL is exactly 2 path segments after the domain (/series/[slug]),
 * chapter URL is exactly 3 (/series/[slug]/chapter-[num], where N can be an
 * integer or decimal, e.g. chapter-621, chapter-510.1). No other top-level
 * route collides with /series/... at that depth, so no reserved-path
 * exclusion list is needed. The chapter number is plainly in the URL, so
 * (unlike WeebCentralAdapter/MangaDexAdapter, which both need extra tricks
 * for opaque chapter IDs) no getChapterNumberScript() override is needed
 * here either - mangaHelpers.ts's extractChapterNumber() already handles
 * this shape via its generic "chapter-N" pattern.
 *
 * Extraction layers:
 *  1. JSON-LD `@graph` block (an `Article` entry's `.description`) for the
 *     description, with og:description as a fallback.
 *  2. Meta tags - og:title (clean, no site suffix) is preferred over
 *     document.title (which appends " Manhwa"), and og:image for the cover.
 *  3. Plain labelled DOM text - Status/Type/Author/Chapters/Last-update are
 *     rendered as a label element followed by a sibling `<p>` with the
 *     value, next to an SVG icon. No stable CSS classes were confirmed, so
 *     a generic label-then-value structural walk is used instead of
 *     hardcoded selectors.
 *  4. Genres live inside an Astro island element's `props` attribute - an
 *     HTML-attribute-escaped JSON string in Astro's serialized-props array
 *     format (nested arrays with a leading type-tag number before each real
 *     value). Decoded, parsed, and walked defensively in its own try/catch
 *     so a shape change there can't break any other field.
 *
 * Each field is extracted in its own try/catch (same per-field isolation
 * every other adapter here uses) so one broken layer can't sink the whole
 * result.
 */
export class HiveToonsAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'HiveToons';
  }

  getUrlPatterns(): RegExp[] {
    return [/hivetoons\.org/i];
  }

  isChapterPage(url: string): boolean {
    // Verified chapter URL shape: /series/[slug]/chapter-[num], e.g.
    //   https://hivetoons.org/series/lookism/chapter-621
    //   https://hivetoons.org/series/lookism/chapter-510.1
    return /\/series\/[^/?#]+\/chapter-\d+(?:\.\d+)?\/?(?:[?#].*)?$/i.test(url) || super.isChapterPage(url);
  }

  isMangaDetailPage(url: string): boolean {
    if (!this.canHandle(url)) return false;
    if (this.isChapterPage(url)) return false;

    // Verified detail URL shape: exactly 2 path segments, /series/[slug],
    // e.g. https://hivetoons.org/series/lookism
    // No other top-level route collides with /series/... at that depth, so
    // no reserved-path exclusion list is needed here.
    return /\/series\/[^/?#]+\/?(?:[?#].*)?$/i.test(url);
  }

  getSeriesUrlFromChapter(chapterUrl: string): string | null {
    // The chapter path carries the same slug as the detail page, just with
    // an extra /chapter-N segment - e.g. /series/lookism/chapter-621 ->
    // slug "lookism" -> /series/lookism.
    const match = chapterUrl.match(/\/series\/([^/?#]+)\/chapter-\d+(?:\.\d+)?\/?(?:[?#].*)?$/i);
    if (!match) return null;
    const origin = chapterUrl.match(/^https?:\/\/[^/]+/i);
    if (!origin) return null;
    return `${origin[0]}/series/${match[1]}`;
  }

  getChapterUrl(seriesUrl: string, chapterNumber: string): string | null {
    // Inverse of getSeriesUrlFromChapter(): flat /series/[slug]/chapter-N.
    const match = seriesUrl.match(/\/series\/([^/?#]+)/i);
    const origin = seriesUrl.match(/^https?:\/\/[^/]+/i);
    if (!match || !origin) return null;
    return `${origin[0]}/series/${match[1]}/chapter-${chapterNumber}`;
  }

  getInjectionScript(): string {
    return `
      (function() {
        try {
          const data = {};

          // HiveToons's own brand/placeholder text - never accept these as
          // a real manga title (same hardening as the other adapters here).
          const isGenericBrandTitle = (t) => {
            if (!t) return true;
            const normalized = t.trim().toLowerCase().replace(/[\\s\\-_|:]+/g, ' ').trim();
            if (!normalized) return true;
            return ['hivetoons', 'hive toons', 'home', 'loading', 'manhwa', 'series'].includes(normalized);
          };

          // Layer 0: JSON-LD @graph - used for description primarily.
          let ldArticle = null;
          try {
            const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const s of ldScripts) {
              try {
                const parsed = JSON.parse((s.textContent || '').trim());
                const graph = Array.isArray(parsed)
                  ? parsed
                  : (parsed && Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed]);
                const article = graph.find(p => {
                  if (!p || typeof p !== 'object') return false;
                  const type = p['@type'];
                  const isArticle = type === 'Article' || (Array.isArray(type) && type.indexOf('Article') !== -1);
                  return isArticle && !!p.description;
                });
                if (article) {
                  ldArticle = article;
                  break;
                }
              } catch (e) {
                // Not this script block - keep looking.
              }
            }
          } catch (e) {
            ldArticle = null;
          }

          // Title - og:title on this site is clean ("Lookism", no suffix),
          // preferred over document.title, which appends " Manhwa" (e.g.
          // "Lookism Manhwa").
          let title = '';
          try {
            const metaTitle = document.querySelector('meta[property="og:title"]');
            const metaTitleText = metaTitle && metaTitle.content ? metaTitle.content.trim() : '';
            if (!isGenericBrandTitle(metaTitleText)) title = metaTitleText;
          } catch (e) {}
          if (!title) {
            try {
              const docTitle = document.title.replace(/\\s+Manhwa\\s*$/i, '').trim();
              if (!isGenericBrandTitle(docTitle)) title = docTitle;
            } catch (e) {}
          }
          if (!title) {
            try {
              const h1 = document.querySelector('h1');
              const h1Text = h1 ? h1.textContent.trim() : '';
              if (!isGenericBrandTitle(h1Text)) title = h1Text;
            } catch (e) {}
          }
          data.title = title;

          // Description
          let description = '';
          try {
            if (ldArticle && ldArticle.description) description = String(ldArticle.description).trim();
          } catch (e) {}
          if (!description) {
            try {
              const metaDesc = document.querySelector('meta[property="og:description"]') ||
                              document.querySelector('meta[name="description"]');
              if (metaDesc && metaDesc.content) description = metaDesc.content.trim();
            } catch (e) {}
          }
          data.description = description.substring(0, 500);

          // Cover image
          try {
            const metaImg = document.querySelector('meta[property="og:image"]');
            if (metaImg && metaImg.content) data.coverImage = metaImg.content;
          } catch (e) {}

          // Generic label-then-value helper: finds an element whose own
          // (non-descendant) text matches one of the given label words, then
          // reads the closest following <p> for the value. No stable CSS
          // classes were confirmed on this site, so this structural walk is
          // used instead of hardcoded selectors - the DOM shape is a
          // heading/label element (next to an SVG icon) followed by a
          // sibling <p> containing the value.
          const getValueForLabel = (labelWords) => {
            try {
              const lowerWords = labelWords.map(w => w.toLowerCase());
              const candidates = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,span,div,p,label,dt'));
              for (const el of candidates) {
                const ownText = Array.from(el.childNodes)
                  .filter(n => n.nodeType === 3)
                  .map(n => (n.textContent || '').trim())
                  .join(' ')
                  .trim();
                const text = (ownText || (el.textContent || '').trim()).toLowerCase();
                if (lowerWords.indexOf(text) === -1) continue;

                const findP = (start) => {
                  let sib = start;
                  while (sib) {
                    if (sib.tagName === 'P') return sib.textContent.trim();
                    if (sib.querySelector) {
                      const p = sib.querySelector('p');
                      if (p) return p.textContent.trim();
                    }
                    sib = sib.nextElementSibling;
                  }
                  return '';
                };

                let value = findP(el.nextElementSibling);
                if (!value && el.parentElement) {
                  value = findP(el.parentElement.nextElementSibling);
                }
                if (value) return value;
              }
            } catch (e) {}
            return '';
          };

          // Author
          try {
            const author = getValueForLabel(['Author', 'Author(s)', 'Authors']);
            if (author) data.author = author;
          } catch (e) {}

          // Status - "ONGOING"/"COMPLETED"/"HIATUS"/"DROPPED"/"CANCELLED".
          // "Type" (Manhwa/Manga/Manhua) is a separate field with no place
          // in MangaMetadata, so it's read only to be ignored/dropped.
          try {
            const statusText = getValueForLabel(['Status']).toLowerCase();
            if (statusText.includes('ongoing')) data.mangaStatus = 'ongoing';
            else if (statusText.includes('completed')) data.mangaStatus = 'completed';
            else if (statusText.includes('hiatus')) data.mangaStatus = 'hiatus';
            else if (statusText.includes('dropped') || statusText.includes('cancel')) data.mangaStatus = 'cancelled';
            else data.mangaStatus = 'ongoing';
          } catch (e) {
            data.mangaStatus = 'ongoing';
          }

          // Total chapters
          try {
            const chaptersText = getValueForLabel(['Chapters']);
            const chaptersMatch = chaptersText.match(/\\d+/);
            if (chaptersMatch) data.totalChapters = parseInt(chaptersMatch[0], 10);
          } catch (e) {}

          // lastChapterAdded is a CHAPTER NUMBER (see types.ts / other
          // adapters), not a date - the "Last update" label on this site is
          // a relative date ("3 days ago") and must never be assigned here
          // directly (a prior version of this file did exactly that, which
          // fed garbage straight into the library quick-view's "jump to
          // latest chapter" button - parseFloat("3 days ago") silently
          // returns 3 instead of failing, so it looked numeric enough to
          // pass validation, and the raw string then got used as a URL
          // path segment, 404ing). This site's "Chapters" count IS the
          // latest chapter number for sequentially-numbered releases, so
          // reuse totalChapters instead of trying to parse a real number
          // out of the date text.
          if (data.totalChapters) data.lastChapterAdded = String(data.totalChapters);

          // Genres - NOT in plain DOM text on this site. They live inside an
          // Astro island element's "props" attribute, an HTML-attribute-
          // escaped JSON string in Astro's serialized-props array format
          // (nested arrays with a leading type-tag number before each real
          // value), e.g.:
          //   genres":[1,[[0,{"id":2,"name":"Drama"}],[0,{"id":4,"name":"Shounen"}]]]
          // Wrapped entirely in its own try/catch so a shape change here
          // can't break any other field - if this fails, genres just come
          // back as an empty array.
          try {
            let propsRaw = null;
            try {
              const propsEls = Array.from(document.querySelectorAll('[props]'));
              for (const el of propsEls) {
                const v = el.getAttribute('props');
                if (v && v.indexOf('genres') !== -1) {
                  propsRaw = v;
                  break;
                }
              }
            } catch (e) {}
            if (!propsRaw) {
              const allEls = document.querySelectorAll('*');
              outer:
              for (const el of allEls) {
                const attrs = el.attributes ? Array.from(el.attributes) : [];
                for (const attr of attrs) {
                  if (attr.value && attr.value.indexOf('genres') !== -1 && attr.value.indexOf('{') !== -1) {
                    propsRaw = attr.value;
                    break outer;
                  }
                }
              }
            }

            let genres = [];
            if (propsRaw) {
              // HTML-unescape entities - a small manual entity-decode table,
              // no DOMParser dependency needed in the injected context.
              const decodeEntities = (str) => {
                const entityMap = {
                  '&quot;': '"', '&#34;': '"', '&#x22;': '"',
                  '&apos;': "'", '&#39;': "'", '&#x27;': "'",
                  '&amp;': '&', '&lt;': '<', '&gt;': '>',
                  '&#x2F;': '/', '&#47;': '/',
                };
                return str.replace(/&#?[a-zA-Z0-9]+;/g, (m) => (entityMap[m] !== undefined ? entityMap[m] : m));
              };
              const decoded = decodeEntities(propsRaw);
              const parsed = JSON.parse(decoded);

              // Find the subtree keyed "genres" anywhere in the parsed
              // structure first, so we don't accidentally sweep up
              // unrelated {id,name} objects (authors, artists, etc.).
              const findGenresNode = (node, depth) => {
                if (!node || typeof node !== 'object' || depth > 12) return null;
                if (Array.isArray(node)) {
                  for (const item of node) {
                    const found = findGenresNode(item, depth + 1);
                    if (found) return found;
                  }
                  return null;
                }
                if (Object.prototype.hasOwnProperty.call(node, 'genres')) {
                  return node.genres;
                }
                for (const key of Object.keys(node)) {
                  const found = findGenresNode(node[key], depth + 1);
                  if (found) return found;
                }
                return null;
              };

              const genresNode = findGenresNode(parsed, 0);
              const names = [];
              const collectNames = (node, depth) => {
                if (!node || typeof node !== 'object' || depth > 12) return;
                if (Array.isArray(node)) {
                  for (const item of node) collectNames(item, depth + 1);
                  return;
                }
                if (typeof node.name === 'string' && node.id !== undefined) {
                  names.push(node.name);
                  return;
                }
                for (const key of Object.keys(node)) collectNames(node[key], depth + 1);
              };
              collectNames(genresNode || parsed, 0);
              genres = names;
            }
            data.genres = Array.from(new Set(genres.map(g => String(g).trim()).filter(Boolean))).slice(0, 8);
          } catch (e) {
            data.genres = [];
          }

          data.sourceUrl = window.location.href.split('?')[0];
          data.sourceWebsite = 'HiveToons';

          console.log('HiveToons extraction:', {
            title: data.title,
            titleLength: data.title.length,
            hasDescription: !!data.description,
            hasCover: !!data.coverImage,
            genresCount: data.genres.length
          });

          return JSON.stringify(data);
        } catch(e) {
          console.log('HiveToons extraction error:', e);
          return JSON.stringify({ error: e.message });
        }
      })();
    `;
  }
}
