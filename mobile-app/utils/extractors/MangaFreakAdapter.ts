import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

/**
 * MangaFreak Adapter
 *
 * Supports: https://mangafreak.me/Manga/[slug] (detail),
 *           https://mangafreak.me/Read1_[slug]_[num] (chapter)
 *
 * NOTE (2026-08): mangafreak.me 301-redirects to a numbered mirror
 * subdomain (verified live: ww3.mangafreak.me at the time of writing, but
 * this has historically rotated - ww1/ww2/etc), preserving the path. The
 * bare domain pattern below matches both, so the redirect resolves
 * transparently without needing to track the current mirror number.
 *
 * Fully server-side rendered - verified via curl, no browser JS execution
 * needed for the detail page's content to appear, and no Cloudflare
 * challenge sits in front of it. All metadata lives as plain labelled
 * `<div>` text inside `.manga_series_data` (e.g. "Written By: Oda,
 * Eiichiro", "This is ON-GOING series") rather than JSON-LD or a
 * hydration payload - there is no richer structured-data source on this
 * site, so DOM text-label parsing is the primary (not fallback) layer.
 */
export class MangaFreakAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'MangaFreak';
  }

  getUrlPatterns(): RegExp[] {
    return [/mangafreak\.me/i];
  }

  isChapterPage(url: string): boolean {
    // Verified chapter URL shape: /Read1_[slug]_[num], e.g.
    //   https://ww3.mangafreak.me/Read1_One_Piece_1191
    // The "1" after "Read" has been seen constant across chapters/manga on
    // this site, but matched loosely (\d*) in case it varies by series.
    return /\/Read\d*_[^/?#]+_\d+(?:\.\d+)?\/?(?:[?#].*)?$/i.test(url) || super.isChapterPage(url);
  }

  isMangaDetailPage(url: string): boolean {
    if (!this.canHandle(url)) return false;
    // Verified detail URL shape: /Manga/[slug], e.g.
    //   https://ww3.mangafreak.me/Manga/One_Piece
    // Distinct enough from /Read1_.../ (chapters) and /Genre/... (genre
    // listing pages) that no reserved-path exclusion list is needed.
    return /\/Manga\/[^/?#]+\/?(?:[?#].*)?$/i.test(url) && !this.isChapterPage(url);
  }

  getSeriesUrlFromChapter(chapterUrl: string): string | null {
    // Unlike WeebCentral/MangaDex's opaque chapter IDs, MangaFreak's chapter
    // slug is literally the same slug as the detail page, just glued to the
    // chapter number with an underscore instead of appearing at /Manga/ -
    // e.g. /Read1_One_Piece_1191 -> slug "One_Piece" -> /Manga/One_Piece.
    const match = chapterUrl.match(/\/Read\d*_(.+)_\d+(?:\.\d+)?\/?(?:[?#].*)?$/i);
    if (!match) return null;
    const origin = chapterUrl.match(/^https?:\/\/[^/]+/i);
    if (!origin) return null;
    return `${origin[0]}/Manga/${match[1]}`;
  }

  getChapterUrl(seriesUrl: string, chapterNumber: string): string | null {
    // Inverse of getSeriesUrlFromChapter(): the slug is read straight out of
    // the detail URL (/Manga/[slug]) and glued into the flat chapter shape.
    const match = seriesUrl.match(/\/Manga\/([^/?#]+)/i);
    if (!match) return null;
    const origin = seriesUrl.match(/^https?:\/\/[^/]+/i);
    if (!origin) return null;
    return `${origin[0]}/Read1_${match[1]}_${chapterNumber}`;
  }

  getInjectionScript(): string {
    return `
      (function() {
        try {
          const data = {};

          // MangaFreak's own brand/placeholder text - never accept these as
          // a real manga title (same hardening as the other adapters here:
          // a title that resolves to just this text LOOKS like a successful
          // extraction but would get cached against the wrong manga).
          const isGenericBrandTitle = (t) => {
            if (!t) return true;
            const normalized = t.trim().toLowerCase().replace(/[\\s\\-_|:]+/g, ' ').trim();
            if (!normalized) return true;
            return ['mangafreak', 'read free manga online', 'home', 'loading', 'manga'].includes(normalized);
          };

          // Title
          let title = '';
          try {
            const h1 = document.querySelector('.manga_series_data h1') || document.querySelector('h1');
            const h1Text = h1 ? h1.textContent.trim() : '';
            if (!isGenericBrandTitle(h1Text)) title = h1Text;
          } catch (e) {}
          if (!title) {
            try {
              const metaTitle = document.querySelector('meta[property="og:title"]');
              const metaTitleText = metaTitle && metaTitle.content ? metaTitle.content.trim() : '';
              // og:title on this site is "<Manga Name> Manga Chapter List - MangaFreak"
              const stripped = metaTitleText.replace(/\\s*Manga Chapter List\\s*-\\s*MangaFreak\\s*$/i, '').trim();
              if (!isGenericBrandTitle(stripped)) title = stripped;
            } catch (e) {}
          }
          data.title = title;

          // Description
          let description = '';
          try {
            const descHeading = Array.from(document.querySelectorAll('.manga_series_description div'))
              .find(el => el.textContent.trim().toLowerCase() === 'synopsis');
            const descP = descHeading ? descHeading.nextElementSibling : document.querySelector('.manga_series_description p');
            if (descP && descP.textContent) description = descP.textContent.trim();
          } catch (e) {}
          if (!description) {
            try {
              const metaDesc = document.querySelector('meta[property="og:description"]');
              if (metaDesc && metaDesc.content) description = metaDesc.content.trim();
            } catch (e) {}
          }
          data.description = description.substring(0, 500);

          // Cover image
          try {
            const img = document.querySelector('.manga_series_image img');
            if (img && img.src) data.coverImage = img.src;
          } catch (e) {}
          if (!data.coverImage) {
            try {
              const metaImg = document.querySelector('meta[property="og:image"]');
              if (metaImg && metaImg.content) data.coverImage = metaImg.content;
            } catch (e) {}
          }

          // The rest of the fields all live as plain labelled text inside
          // .manga_series_data - collect its direct child divs once and
          // read from that instead of re-querying per field.
          let infoLines = [];
          try {
            infoLines = Array.from(document.querySelectorAll('.manga_series_data > div'))
              .map(el => el.textContent.trim())
              .filter(Boolean);
          } catch (e) {}

          // Alternative titles - "Alternative Title: X, Y" (comma-separated,
          // sometimes just repeats the main title - kept as-is either way).
          try {
            const altLine = infoLines.find(l => /^Alternative Title:/i.test(l));
            if (altLine) {
              const alts = altLine.replace(/^Alternative Title:\\s*/i, '')
                .split(',').map(s => s.trim()).filter(Boolean);
              if (alts.length > 0) data.alternativeTitles = Array.from(new Set(alts)).slice(0, 10);
            }
          } catch (e) {}

          // Status - rendered as a full sentence, e.g. "This is ON-GOING
          // series" / "This is COMPLETED series".
          try {
            const statusLine = (infoLines.find(l => /^This is /i.test(l)) || '').toLowerCase();
            if (statusLine.includes('on-going') || statusLine.includes('ongoing')) data.mangaStatus = 'ongoing';
            else if (statusLine.includes('completed')) data.mangaStatus = 'completed';
            else if (statusLine.includes('hiatus')) data.mangaStatus = 'hiatus';
            else if (statusLine.includes('cancel') || statusLine.includes('dropped')) data.mangaStatus = 'cancelled';
            else data.mangaStatus = 'ongoing';
          } catch (e) {
            data.mangaStatus = 'ongoing';
          }

          // Author / artist - "Written By: X" / "Illustrated By: Y".
          try {
            const writtenLine = infoLines.find(l => /^Written By:/i.test(l));
            if (writtenLine) data.author = writtenLine.replace(/^Written By:\\s*/i, '').trim();
          } catch (e) {}
          try {
            const illustratedLine = infoLines.find(l => /^Illustrated By:/i.test(l));
            if (illustratedLine) data.artist = illustratedLine.replace(/^Illustrated By:\\s*/i, '').trim();
          } catch (e) {}

          // Genres
          try {
            const genreEls = document.querySelectorAll('.series_sub_genre_list a');
            data.genres = Array.from(new Set(
              Array.from(genreEls).map(el => el.textContent.trim()).filter(Boolean)
            )).slice(0, 8);
          } catch (e) {
            data.genres = [];
          }

          data.sourceUrl = window.location.href.split('?')[0];
          data.sourceWebsite = 'MangaFreak';

          console.log('MangaFreak extraction:', {
            title: data.title,
            titleLength: data.title.length,
            hasDescription: !!data.description,
            hasCover: !!data.coverImage,
            genresCount: data.genres.length
          });

          return JSON.stringify(data);
        } catch(e) {
          console.log('MangaFreak extraction error:', e);
          return JSON.stringify({ error: e.message });
        }
      })();
    `;
  }
}
