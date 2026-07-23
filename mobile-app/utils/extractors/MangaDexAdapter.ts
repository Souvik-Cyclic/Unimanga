import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

/**
 * MangaDex Adapter
 *
 * Supports: https://mangadex.org/title/<uuid>/<slug> (detail),
 *           https://mangadex.org/chapter/<uuid> (chapter)
 *
 * Unlike every other adapter here, this one does NOT scrape the DOM.
 * mangadex.org is a client-rendered SPA - by the time any of our staggered
 * injection attempts run, the page may still be mid-hydration, and there's
 * no server-rendered HTML to fall back to (verified via curl: the initial
 * response is a near-empty shell). MangaDex instead publishes a stable,
 * CORS-open public REST API (api.mangadex.org) that returns the exact same
 * data the site itself renders from - fetching it directly is both more
 * reliable and far simpler than reverse-engineering a Vue hydration payload.
 *
 * Async caveat: MetadataService.getInjectionScript() and useWebView.ts's
 * chapter-number wrapper both assume `getInjectionScript()`/
 * `getChapterNumberScript()` return SYNCHRONOUSLY (`const result = ${script}`
 * followed immediately by `postMessage(result)`), because every other
 * adapter here reads directly from the already-loaded DOM. A `fetch()` call
 * can't satisfy that. Both scripts below work around it the same way: return
 * a harmless synchronous placeholder immediately (empty title / null chapter
 * number - both treated as "nothing found yet" by the callers, not an error),
 * then run the real fetch in a detached async IIFE that calls
 * `window.ReactNativeWebView.postMessage()` itself once the API responds.
 * That second, later message is indistinguishable from a normal extraction
 * result to `handleWebViewMessage` - it's just another message on the same
 * channel - so no changes to the surrounding hook/service code are needed.
 */
export class MangaDexAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'MangaDex';
  }

  getUrlPatterns(): RegExp[] {
    return [/mangadex\.org/i];
  }

  isChapterPage(url: string): boolean {
    return new RegExp(`/chapter/${UUID}`, 'i').test(url);
  }

  isMangaDetailPage(url: string): boolean {
    if (!this.canHandle(url)) return false;
    return new RegExp(`/title/${UUID}`, 'i').test(url);
  }

  getSeriesUrlFromChapter(_chapterUrl: string): string | null {
    // Chapter URLs carry only the chapter's own UUID, not the manga's - the
    // relationship only exists in the API response, not the URL string, so
    // (like WeebCentralAdapter's opaque ULID chapters) there's no regex that
    // can recover it here.
    return null;
  }

  getInjectionScript(): string {
    return `
      (function() {
        try {
          const match = window.location.href.match(/\\/title\\/(${UUID})/i);
          if (!match) {
            return JSON.stringify({ error: 'No manga id in URL' });
          }
          const mangaId = match[1];

          (async function() {
            try {
              const res = await fetch(
                'https://api.mangadex.org/manga/' + mangaId +
                '?includes[]=author&includes[]=artist&includes[]=cover_art'
              );
              const json = await res.json();
              const manga = json && json.data;
              if (!manga || !manga.attributes) {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'Manga not found in API response' }));
                }
                return;
              }

              const attrs = manga.attributes;
              const data = {};

              const titleObj = attrs.title || {};
              data.title = titleObj.en || Object.values(titleObj)[0] || '';

              try {
                const altSet = [];
                (attrs.altTitles || []).forEach(function(t) {
                  const v = Object.values(t)[0];
                  if (v) altSet.push(v);
                });
                if (altSet.length > 0) data.alternativeTitles = Array.from(new Set(altSet)).slice(0, 10);
              } catch (e) {}

              try {
                const descObj = attrs.description || {};
                const desc = descObj.en || Object.values(descObj)[0] || '';
                data.description = String(desc).substring(0, 500);
              } catch (e) {
                data.description = '';
              }

              try {
                const genres = [];
                (attrs.tags || []).forEach(function(tag) {
                  const group = tag.attributes && tag.attributes.group;
                  const name = tag.attributes && tag.attributes.name && tag.attributes.name.en;
                  if (name && (group === 'genre' || group === 'theme')) genres.push(name);
                });
                data.genres = Array.from(new Set(genres)).slice(0, 8);
              } catch (e) {
                data.genres = [];
              }

              try {
                const status = String(attrs.status || '').toLowerCase();
                data.mangaStatus = ['ongoing', 'completed', 'hiatus', 'cancelled'].includes(status) ? status : 'ongoing';
              } catch (e) {
                data.mangaStatus = 'ongoing';
              }

              try {
                const rels = manga.relationships || [];
                const authorNames = rels
                  .filter(function(r) { return r.type === 'author'; })
                  .map(function(r) { return r.attributes && r.attributes.name; })
                  .filter(Boolean);
                const artistNames = rels
                  .filter(function(r) { return r.type === 'artist'; })
                  .map(function(r) { return r.attributes && r.attributes.name; })
                  .filter(Boolean);
                if (authorNames.length) data.author = authorNames.join(', ');
                if (artistNames.length) data.artist = artistNames.join(', ');

                const coverRel = rels.find(function(r) { return r.type === 'cover_art'; });
                if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
                  data.coverImage = 'https://uploads.mangadex.org/covers/' + mangaId + '/' + coverRel.attributes.fileName + '.512.jpg';
                }
              } catch (e) {}

              data.sourceUrl = window.location.href.split('?')[0];
              data.sourceWebsite = 'MangaDex';

              console.log('MangaDex extraction:', {
                title: data.title,
                hasDescription: !!data.description,
                hasCover: !!data.coverImage,
                genresCount: (data.genres || []).length,
              });

              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(data));
              }
            } catch (e) {
              console.log('MangaDex async extraction error:', e);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ error: e.message }));
              }
            }
          })();

          // Synchronous placeholder - see class doc comment. The real
          // payload is posted above once the API fetch resolves.
          return JSON.stringify({ title: '' });
        } catch(e) {
          console.log('MangaDex extraction error:', e);
          return JSON.stringify({ error: e.message });
        }
      })();
    `;
  }

  getChapterNumberScript(): string {
    return `
      (function() {
        try {
          const match = window.location.href.match(/\\/chapter\\/(${UUID})/i);
          if (!match) {
            return JSON.stringify({ chapterNumber: null });
          }
          const chapterId = match[1];

          (async function() {
            try {
              const res = await fetch('https://api.mangadex.org/chapter/' + chapterId);
              const json = await res.json();
              const num = json && json.data && json.data.attributes && json.data.attributes.chapter;
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  _chapterNumberPayload: true,
                  chapterNumber: num ? String(num) : null,
                  sourceUrl: window.location.href.split('?')[0],
                }));
              }
            } catch (e) {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  _chapterNumberPayload: true,
                  chapterNumber: null,
                  error: e.message,
                }));
              }
            }
          })();

          // Synchronous placeholder - see class doc comment.
          return JSON.stringify({ chapterNumber: null });
        } catch(e) {
          return JSON.stringify({ chapterNumber: null, error: e.message });
        }
      })();
    `;
  }
}
