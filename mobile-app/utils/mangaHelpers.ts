/**
 * Clean manga title by removing chapter numbers and website names
 * Examples:
 * "Swordmaster's Youngest Son Chapter 194 - Asura Scans" -> "Swordmaster's Youngest Son"
 * "One Piece Ch. 1050" -> "One Piece"
 */
export function cleanMangaTitle(title: string): string {
  if (!title) return '';
  
  // Remove website suffixes like " - Asura Scans", " - WeebCentral", etc
  let cleaned = title.replace(/\s*[-–—]\s*(Asura\s*Scans?|Webtoons?|MangaFire|Manga\s*Fire|WeebCentral|Weeb\s*Central)\s*$/i, '');
  
  // Remove chapter indicators at the end
  // Matches: "Chapter 194", "Ch. 194", "Ch 194", "Episode 50", "Ep. 50", etc.
  cleaned = cleaned.replace(/\s+(Chapter|Ch\.?|Episode|Ep\.?)\s+\d+(\.\d+)?\s*$/i, '');
  
  return cleaned.trim();
}

/**
 * Extract chapter number from URL or title
 * Examples:
 * "https://asuracomic.net/series/swordmasters-youngest-son-b62b5a15/chapter/194" -> "194"
 * "https://mangafire.to/read/solo-leveling.1pv7/en/chapter-150" -> "150"
 * "https://mangafire.to/manga/solo-leveling.1pv7?chapter=150" -> "150"
 * "https://weebcentral.com/chapter/abc123" -> null (needs title parsing)
 * "Chapter 194" -> "194"
 */
export function extractChapterNumber(url: string, title?: string): string | null {
  console.log('[extractChapterNumber] Checking URL:', url);
  
  // Pattern 1: MangaFire - /chapter-123, {id}-chapter-123-en (current MangaFire
  // scheme embeds the chapter segment after a chapter-id prefix joined by a
  // dash, not a slash - e.g. .../title/{id}-slug/{chapterId}-chapter-45-en),
  // or ?chapter=123
  const mangaFireMatch = url.match(/[/-]chapter-(\d+(?:\.\d+)?)|[?&]chapter=(\d+(?:\.\d+)?)/i);
  if (mangaFireMatch) {
    const chapter = mangaFireMatch[1] || mangaFireMatch[2];
    console.log('[extractChapterNumber] Found (MangaFire):', chapter);
    return chapter;
  }
  
  // Sites can embed their own internal IDs (manga ID, chapter ID) in a URL
  // shape that superficially looks like one of the patterns below - a real
  // chapter number never gets anywhere near this large, so anything past a
  // generous ceiling is rejected as an ID caught by mistake rather than a
  // genuine chapter number (this is exactly how a MangaFire chapter ID
  // once got logged as "Chapter 9368024" - see Pattern 2's comment).
  const isPlausibleChapterNumber = (n: string) => parseFloat(n) > 0 && parseFloat(n) < 10000;

  // Pattern 2: /chapter/123 or /ch/123 or /episode/123
  const urlMatch = url.match(/\/(chapter|ch|episode|ep)\/(\d+(?:\.\d+)?)/i);
  if (urlMatch && isPlausibleChapterNumber(urlMatch[2])) {
    console.log('[extractChapterNumber] Found (standard):', urlMatch[2]);
    return urlMatch[2];
  }

  // Pattern 3: /read/manga-name/en/chapter-123
  const readMatch = url.match(/\/read\/[^/]+\/[^/]+\/chapter-?(\d+(?:\.\d+)?)/i);
  if (readMatch && isPlausibleChapterNumber(readMatch[1])) {
    console.log('[extractChapterNumber] Found (read pattern):', readMatch[1]);
    return readMatch[1];
  }

  // Pattern 3b: MangaFreak - /Read1_Slug_Name_123 (chapter number is glued to
  // the slug with an underscore, not slash-delimited, so Pattern 4 below
  // can't catch it - it only matches a number that's its own path segment).
  const mangaFreakMatch = url.match(/\/Read\d*_[^/?#]+?_(\d+(?:\.\d+)?)(?:[/?#]|$)/i);
  if (mangaFreakMatch && isPlausibleChapterNumber(mangaFreakMatch[1])) {
    console.log('[extractChapterNumber] Found (MangaFreak):', mangaFreakMatch[1]);
    return mangaFreakMatch[1];
  }

  // Pattern 3c: MangaTaro - /read/[slug]/ch[num]-[chapterId], e.g.
  // /read/dandadan/ch244-700182. The chapter id suffix after the number
  // means Pattern 4 below can't be relied on either (it would grab the
  // chapter id, not the chapter number, since that's the number actually
  // at the end of the path).
  const mangaTaroMatch = url.match(/\/ch(\d+(?:\.\d+)?)-\d+(?:[/?#]|$)/i);
  if (mangaTaroMatch && isPlausibleChapterNumber(mangaTaroMatch[1])) {
    console.log('[extractChapterNumber] Found (MangaTaro):', mangaTaroMatch[1]);
    return mangaTaroMatch[1];
  }

  // Pattern 4: /123 at the end (common in some sites)
  const endNumberMatch = url.match(/\/(\d+(?:\.\d+)?)(?:\/|$)/);
  if (endNumberMatch && parseFloat(endNumberMatch[1]) > 0 && parseFloat(endNumberMatch[1]) < 10000) {
    console.log('[extractChapterNumber] Found (end number):', endNumberMatch[1]);
    return endNumberMatch[1];
  }
  
  // If URL extraction fails, try title
  if (title) {
    const titleMatch = title.match(/(?:Chapter|Ch\.?|Episode|Ep\.?)\s+(\d+(?:\.\d+)?)/i);
    if (titleMatch) {
      console.log('[extractChapterNumber] Found (from title):', titleMatch[1]);
      return titleMatch[1];
    }
  }
  
  console.log('[extractChapterNumber] No chapter found');
  return null;
}

/**
 * Format chapter display text
 * @param currentChapter Current chapter string (e.g., "194", "0")
 * @returns Formatted string like "Chapter 194"
 */
export function formatChapterDisplay(currentChapter: string | number): string {
  const chapter = currentChapter.toString();
  
  // Don't show "Chapter 0"
  if (chapter === '0' || chapter === '') {
    return 'Not started';
  }
  
  return `Chapter ${chapter}`;
}

/**
 * Format a past timestamp as a short relative label - "Just now", "5m ago",
 * "3h ago", "7d ago", falling back to a plain date once it's old enough
 * that a relative count stops being useful.
 */
export function formatRelativeTime(when: string | Date): string {
  const date = typeof when === 'string' ? new Date(when) : when;
  const diffMs = Date.now() - date.getTime();
  if (isNaN(diffMs)) return '';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  // "min" not "m" - a bare "m" reads as "months" by the convention most
  // relative-time UIs use (m=months, min=minutes), so "3m ago" on a manga
  // added seconds ago looks like a stale/wrong timestamp at a glance even
  // though the value itself is correct.
  if (minutes < 60) return `${minutes}min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Calculate progress percentage based on current chapter and total chapters
 */
export function calculateProgress(currentChapter: string | number, totalChapters?: number): number {
  if (!totalChapters || totalChapters === 0) return 0;
  
  const current = parseFloat(currentChapter.toString());
  if (isNaN(current) || current === 0) return 0;
  
  const progress = Math.round((current / totalChapters) * 100);
  return Math.min(100, Math.max(0, progress));
}

/**
 * Extract series/manga detail page URL from a chapter URL
 * Examples:
 * "https://asuracomic.net/series/swordmasters-youngest-son-b62b5a15/chapter/194" 
 * -> "https://asuracomic.net/series/swordmasters-youngest-son-b62b5a15"
 */
export function getSeriesUrl(url: string): string {
  // AsuraScans pattern: remove /chapter/XXX part
  if (url.includes('asuracomic.net') || url.includes('asurascans')) {
    const match = url.match(/(.*\/series\/[^\/]+)/);
    if (match) return match[1];
  }
  
  // WeebCentral, MangaFire, etc. - add patterns as needed
  
  return url;
}

/**
 * Check if a URL is a series/manga detail page (not a chapter page)
 */
export function isSeriesPage(url: string): boolean {
  // AsuraScans
  if (url.includes('asuracomic.net') || url.includes('asurascans')) {
    return url.includes('/series/') && !url.includes('/chapter/');
  }
  
  // Add other website patterns as needed
  
  return false;
}
