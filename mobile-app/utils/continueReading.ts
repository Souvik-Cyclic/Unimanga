import { extractorFactory } from './extractors/ExtractorFactory';
import { Manga } from '../services/api.service';

export interface ContinueTarget {
  /** Chapter number to display on the CTA, e.g. "156". */
  chapterLabel: string;
  /** Where the CTA should open. */
  url: string;
  /** True when this points at a chapter beyond what's been read. */
  isNewChapter: boolean;
}

/**
 * Resolve what the library/history quick-view panel's primary CTA should
 * do: jump straight to a newer chapter if one exists and its URL can be
 * constructed, otherwise resume exactly where the reader left off.
 *
 * "A newer chapter exists" is read off `manga.lastChapterAdded` - the
 * latest chapter number seen the last time this series' metadata was
 * extracted (refreshed on every visit to its detail page, not live here).
 * It can be stale if the site has published more chapters since the last
 * visit, but there's no live "how many chapters does this site have right
 * now" check available without opening the WebView, defeating the point of
 * a lightweight preview panel.
 */
/**
 * Strictly validate a chapter-number string - the WHOLE string must be a
 * plain number (optionally decimal), nothing else. `parseFloat` alone isn't
 * safe for this: it happily parses a leading number out of unrelated text
 * ("3 days ago" -> 3) instead of failing, which previously let a
 * non-chapter-number value (a relative-date string, from a metadata field
 * that got misassigned - see HiveToonsAdapter.ts) pass as if it were valid,
 * flow into a URL as a path segment, and 404. Returns the canonical numeric
 * string (so it can be reused for both the CTA label and the URL, instead
 * of ever re-using the original untrusted string), or null if invalid.
 */
function parseStrictChapterNumber(value: string | undefined): string | null {
  if (!value || !/^\d+(\.\d+)?$/.test(value.trim())) return null;
  return value.trim();
}

export function resolveContinueTarget(
  manga: Manga,
  currentChapter: string,
  lastReadUrl?: string
): ContinueTarget {
  const currentNum = parseFloat(parseStrictChapterNumber(currentChapter) ?? '0');
  const latestChapter = parseStrictChapterNumber(manga.lastChapterAdded);
  const latestNum = latestChapter ? parseFloat(latestChapter) : NaN;
  const hasNewer = !isNaN(latestNum) && latestNum > currentNum;

  if (hasNewer && latestChapter) {
    const adapter = extractorFactory.getAdapterForUrl(manga.sourceUrl);
    const directUrl = adapter?.getChapterUrl(manga.sourceUrl, latestChapter) ?? null;
    return {
      chapterLabel: latestChapter,
      // Sites without a constructible chapter URL (opaque chapter IDs, or a
      // tokened lookup) fall back to the detail page - the reader taps the
      // real chapter link themselves rather than following a guessed one.
      url: directUrl ?? manga.sourceUrl,
      isNewChapter: true,
    };
  }

  return {
    chapterLabel: currentChapter && currentChapter !== '0' ? currentChapter : '1',
    url: lastReadUrl || manga.sourceUrl,
    isNewChapter: false,
  };
}
