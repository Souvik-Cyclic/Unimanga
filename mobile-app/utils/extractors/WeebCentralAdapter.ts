import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

/**
 * WeebCentral Adapter
 * 
 * Supports: https://weebcentral.com/
 * 
 * Features:
 * - Manga and manhwa content
 * - Fast updates
 * - English translations
 */
export class WeebCentralAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'WeebCentral';
  }

  getUrlPatterns(): RegExp[] {
    return [
      /weebcentral\.com\/series/i,
      /weebcentral\.com\/manga/i,
      /weebcentral\.com\/chapters/i,
    ];
  }

  /**
   * Override to detect WeebCentral chapter/reader pages.
   *
   * Verified against live pages (curl, Aug 2026): chapter URLs are
   * `weebcentral.com/chapters/<ULID>` (e.g.
   * `/chapters/01J76XZ36BHKNFA0SVP19XVB7C`) - there is no chapter number
   * (or series info) in the path at all, and no `/chapter/<n>` form exists
   * on the current site. The previous `/\/chapter\/\d+/i` pattern never
   * matched real WeebCentral URLs, which also meant `getUrlPatterns()` not
   * listing `/chapters` caused `canHandle()` to reject chapter pages
   * entirely - the adapter was never even selected for them.
   */
  isChapterPage(url: string): boolean {
    return /\/chapters\//i.test(url);
  }

  /**
   * Override the base class default, which is just `canHandle(url)` - "does
   * this URL belong to this site at all". Since getUrlPatterns() above
   * deliberately includes `/chapters` (so canHandle() selects this adapter
   * on chapter pages too, needed for getChapterNumberScript() to run), the
   * base default would incorrectly call chapter pages "detail pages" too.
   * That let "+ Library" on a chapter page bypass the
   * not-a-detail-page warning in browser.tsx and instead retry a live
   * extraction attempt forever - MetadataService always refuses to actually
   * extract on a chapter page, so every attempt silently failed in a loop.
   */
  isMangaDetailPage(url: string): boolean {
    return this.canHandle(url) && !this.isChapterPage(url);
  }

  /**
   * Override to extract series URL from chapter URL.
   *
   * NOTE: unlike other adapters, this can't actually be derived from the
   * URL string. Verified against live pages: chapter URLs
   * (`/chapters/<ULID>`) carry no series ID or slug anywhere in the path -
   * the series link only exists in the chapter page's DOM (an `<a href=
   * ".../series/<ID>/<slug>">` back-link, and an inline
   * `"series_id"/"series_name"` object in a `<script>` tag), not in the
   * URL. There is no regex that can recover it from `chapterUrl` alone, so
   * this returns null. If a real series URL is needed here, it would need
   * a DOM-injection approach like `getChapterNumberScript()` - that's a
   * `BaseWebsiteAdapter` contract change, out of scope for this file.
   */
  getSeriesUrlFromChapter(_chapterUrl: string): string | null {
    return null;
  }

  /**
   * Hardening notes (Aug 2026): this script is invoked at staggered delays
   * (800ms / 2200ms / 4000ms after landing on the series page - see
   * useWebView.ts's useMetadataExtraction) and the retry loop stops as soon
   * as one attempt returns a truthy `data.title` (MetadataService.parseMetadata's
   * `if (!data.title)` check). WeebCentral's series pages are server-rendered
   * (confirmed via curl, not a client-side SPA render), so `document.title`,
   * `<h1>`, meta tags and the info `<ul>` are all present in the initial HTML
   * response - there's no client-side hydration delay to "wait out". That
   * means even the 800ms attempt should normally succeed as long as the
   * WebView has finished loading *some* HTML by then; there's no DOM
   * readiness signal worth polling for beyond what's already implicit in
   * "the elements exist or they don't".
   *
   * The real risk this hardening addresses is different: originally every
   * extraction step lived under ONE try/catch, so if any single step threw
   * (e.g. a future markup change makes `img.width`/`img.height` access throw,
   * or `metaImg.content` throws on an unexpected node shape), the whole
   * script aborted and returned `{ error: ... }` with NO title at all - even
   * though the title (the only field the retry logic actually checks) had
   * already been extracted successfully a few lines earlier. That's a
   * needless dependency between unrelated fields: a broken cover-image
   * heuristic could sink an otherwise-successful title extraction and force
   * an extra retry (or a permanent miss if all 3 attempts hit the same bug
   * on a slow-loading page).
   *
   * Fix: each independent field group now has its own try/catch, so a
   * failure in cover-image or info-list extraction can't take out the title/
   * description that were already captured. All loops are bounded (Array.find
   * / Array.from over a fixed, already-parsed NodeList) - no polling, no
   * indefinite waits, nothing that can hang the synchronous injection call.
   */
  getInjectionScript(): string {
    return `
      (function() {
        const data = {};
        try {
          // Title - h1 works perfectly on WeebCentral. This is the one field
          // the retry logic in useWebView.ts actually gates on, so it's
          // extracted first and independently of everything below it.
          try {
            const titleEl = document.querySelector('h1');
            if (titleEl && titleEl.textContent && titleEl.textContent.trim()) {
              data.title = titleEl.textContent.trim();
            } else {
              // Fallback to meta tag
              const metaTitle = document.querySelector('meta[property="og:title"]');
              data.title = metaTitle && metaTitle.content
                ? metaTitle.content.replace(' | Weeb Central', '').trim()
                : '';
            }
          } catch (e) {
            data.title = '';
          }

          // Description - WeebCentral relies on meta tags
          try {
            const metaDesc = document.querySelector('meta[property="og:description"]') ||
                            document.querySelector('meta[name="description"]');
            data.description = metaDesc && metaDesc.content ? metaDesc.content.substring(0, 500) : '';
          } catch (e) {
            data.description = '';
          }

          // Cover Image - Look for image with "cover" in alt attribute
          try {
            const images = Array.from(document.querySelectorAll('img'));

            // First, try to find image with "cover" in alt text
            let coverEl = images.find(img =>
              img.alt && img.alt.toLowerCase().includes('cover') &&
              !img.alt.toLowerCase().includes('logo')
            );

            // Fallback to meta og:image (WeebCentral has good meta tags)
            if (!coverEl) {
              const metaImg = document.querySelector('meta[property="og:image"]');
              if (metaImg && metaImg.content && !metaImg.content.includes('brand.png')) {
                data.coverImage = metaImg.content;
              }
            } else {
              data.coverImage = coverEl.src;
            }

            // If still no cover, try finding large image (exclude brand/logo)
            if (!data.coverImage) {
              coverEl = images.find(img =>
                img.src &&
                !img.src.includes('brand.png') &&
                !img.src.includes('logo') &&
                !img.src.includes('icon') &&
                img.width > 200 &&
                img.height > 250
              );
              data.coverImage = coverEl ? coverEl.src : '';
            }
          } catch (e) {
            if (!data.coverImage) data.coverImage = '';
          }

          // Series info list - WeebCentral renders a <ul> of <li><strong>Label: </strong>...</li>
          // entries (Author(s), Tags(s) [genres - sic, site typo], Type, Status,
          // Released, ...). Find the relevant <li> by its <strong> label text
          // and pull the linked values out of it.
          try {
            const infoListItems = Array.from(document.querySelectorAll('li'));
            const findInfoLi = (labelRegex) => infoListItems.find(li => {
              const strong = li.querySelector('strong');
              return strong && labelRegex.test(strong.textContent || '');
            });
            const linkTexts = (li) => li
              ? Array.from(li.querySelectorAll('a')).map(a => a.textContent.trim()).filter(Boolean)
              : [];

            // Author - "Author(s): " li, one or more linked names
            const authorLi = findInfoLi(/author/i);
            const authors = linkTexts(authorLi);
            data.author = authors.length ? authors.join(', ') : '';

            // Genres - "Tags(s): " li (site's own label, includes typo), one or more linked tags
            const tagsLi = findInfoLi(/tag|genre/i);
            const tags = linkTexts(tagsLi);
            data.genres = tags.length ? tags : ['Manga'];

            // Status - "Status: " li, single linked value (Ongoing/Complete/Hiatus/Canceled)
            const statusLi = findInfoLi(/status/i);
            const statusLinks = linkTexts(statusLi);
            const rawStatus = (statusLinks[0] || '').toLowerCase();
            const statusMap = {
              ongoing: 'ongoing',
              complete: 'completed',
              completed: 'completed',
              hiatus: 'hiatus',
              canceled: 'cancelled',
              cancelled: 'cancelled',
            };
            data.mangaStatus = statusMap[rawStatus] || 'ongoing';
          } catch (e) {
            if (!data.author) data.author = '';
            if (!data.genres) data.genres = ['Manga'];
            if (!data.mangaStatus) data.mangaStatus = 'ongoing';
          }

          data.sourceUrl = window.location.href.split('?')[0];
          data.sourceWebsite = 'WeebCentral';

          return JSON.stringify(data);
        } catch(e) {
          // Belt-and-suspenders outer catch: even if something above escaped
          // its own try/catch, still surface whatever we already captured
          // (title especially) instead of losing it to an unrelated error.
          data.error = e.message;
          if (data.sourceUrl === undefined) data.sourceUrl = window.location.href.split('?')[0];
          if (data.sourceWebsite === undefined) data.sourceWebsite = 'WeebCentral';
          return JSON.stringify(data);
        }
      })();
    `;
  }

  /**
   * WeebCentral chapter URLs use an opaque ULID chapter ID
   * (e.g. /chapters/01JCV081KZ2EHN7KXTYJ04YNRF), so the chapter number can't
   * be pulled from the URL. Instead, read it off the page itself.
   *
   * Verified against live pages (curl, Aug 2026) - key findings that changed
   * this from the original guessed version:
   * - There is NO chapter-navigation <select> in the initial DOM. The
   *   "Select Chapter" control is a <dialog> whose contents are lazily
   *   fetched via HTMX only after the user clicks it - it doesn't exist on
   *   page load, so a <select>-based lookup never finds anything (it's not
   *   wrong, just always a no-op on first load).
   * - WeebCentral labels chapters "Chapter N" for manga (e.g. "Chapter 1187
   *   | One Piece | Weeb Central") but "Episode N" for OEL/webtoon-style
   *   series (e.g. "Episode 1 | The Beginning After the End | Weeb
   *   Central") - both in <title>, og:title, AND an inline per-page
   *   `<script>` object. The old regex only matched "chapter", so it silently
   *   failed on every OEL/webtoon title.
   * - Every chapter page embeds an Alpine.js history-tracking object literal
   *   directly in a <script> tag, e.g.:
   *     { "series_id": "...", "series_name": "One Piece",
   *       "chapter": "Chapter 1187", "chapter_path": "/chapters/..." }
   *   This is server-rendered per request and is the most direct signal
   *   available (used by the site itself to record reading history), so it's
   *   tried first via a regex over the full page source.
   *
   * Priority order:
   * 1. The inline history object's "chapter": "..." string embedded in a
   *    <script> tag (most reliable - server-rendered exactly for this page).
   * 2. document.title, e.g. "Chapter 1187 | One Piece | Weeb Central" or
   *    "Episode 1 | The Beginning After the End | Weeb Central".
   * 3. og:title meta tag (mirrors document.title).
   * 4. Chapter navigation <select>, kept as a defensive fallback in case a
   *    logged-in/variant view renders it inline.
   * 5. Any heading or element whose class/id hints at a chapter title.
   */
  getChapterNumberScript(): string {
    return `
      (function() {
        try {
          const chapterRegex = /(?:chapter|episode)\\s*(\\d+(?:\\.\\d+)?)/i;
          let chapterNumber = null;

          // 1. Inline per-page history object embedded in a <script> tag,
          //    e.g. "chapter": "Chapter 1187" or "chapter": "Episode 1"
          const scripts = Array.from(document.querySelectorAll('script'));
          for (const script of scripts) {
            const text = script.textContent || '';
            if (!text.includes('"chapter"')) continue;
            const match = text.match(/["']chapter["']\\s*:\\s*["']([^"']+)["']/i);
            if (match) {
              const numMatch = match[1].match(chapterRegex);
              if (numMatch) {
                chapterNumber = numMatch[1];
                break;
              }
            }
          }

          // 2. document.title, e.g. "Chapter 1187 | One Piece | Weeb Central"
          if (!chapterNumber) {
            const match = document.title && document.title.match(chapterRegex);
            if (match) chapterNumber = match[1];
          }

          // 3. og:title meta tag as a fallback
          if (!chapterNumber) {
            const metaTitle = document.querySelector('meta[property="og:title"]');
            const content = metaTitle ? metaTitle.content : '';
            const match = content && content.match(chapterRegex);
            if (match) chapterNumber = match[1];
          }

          // 4. Chapter navigation dropdown - not present on initial page load
          //    as of this writing (lazily HTMX-loaded on click), but kept as
          //    a defensive fallback in case that changes.
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

          // 5. Headings or elements whose class/id hints at a chapter title
          if (!chapterNumber) {
            const candidates = Array.from(
              document.querySelectorAll('h1, h2, h3, [class*="chapter"], [id*="chapter"]')
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

          return JSON.stringify({ chapterNumber: chapterNumber });
        } catch(e) {
          return JSON.stringify({ chapterNumber: null, error: e.message });
        }
      })();
    `;
  }
}
