/**
 * ADAPTER PATTERN - Base Abstract Class
 * 
 * Defines the contract that all website adapters must follow.
 * This ensures consistent behavior across all manga website extractors.
 */

import { MangaMetadata } from './types';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

/**
 * Abstract base class for all website adapters
 * 
 * Responsibilities:
 * - Define the contract for metadata extraction
 * - Provide URL pattern matching
 * - Validate extracted metadata
 * 
 * To create a new adapter:
 * 1. Extend this class
 * 2. Implement getName(), getUrlPatterns(), and getInjectionScript()
 * 3. Optionally override canHandle() and validateMetadata() for custom logic
 */
export abstract class BaseWebsiteAdapter {
  /**
   * Get the name of the website (e.g., "AsuraScans")
   */
  abstract getName(): string;

  /**
   * Get URL patterns that identify this website
   * Used for automatic adapter selection
   * 
   * @returns Array of RegExp patterns
   */
  abstract getUrlPatterns(): RegExp[];

  /**
   * Generate JavaScript injection code for metadata extraction
   * 
   * This code runs in the WebView context and must:
   * - Extract manga metadata from the DOM
   * - Return a JSON string with all extracted data
   * - Handle errors gracefully and return error information
   * 
   * @returns JavaScript code as a string
   */
  abstract getInjectionScript(): string;

  /**
   * Detect if a given URL belongs to a manga detail page on this website
   * 
   * Override this if you need custom detection logic beyond pattern matching.
   * Default implementation uses getUrlPatterns().
   * 
   * @param url - The URL to check
   * @returns true if this adapter can handle the URL
   */
  canHandle(url: string): boolean {
    return this.getUrlPatterns().some(pattern => pattern.test(url));
  }

  /**
   * Specific check for manga detail pages (series pages)
   * 
   * @param url - The URL to check
   * @returns true if this is a series detail page
   */
  isMangaDetailPage(url: string): boolean {
    return this.canHandle(url);
  }

  /**
   * Validate extracted metadata
   * 
   * Override this to add website-specific validation logic.
   * Default implementation checks for required fields.
   * 
   * @param metadata - The extracted metadata object
   * @returns ValidationResult with isValid flag and optional errors
   */
  validateMetadata(metadata: any): ValidationResult {
    const errors: string[] = [];

    if (!metadata?.title) {
      errors.push('Missing required field: title');
    }
    if (!metadata?.sourceUrl) {
      errors.push('Missing required field: sourceUrl');
    }
    if (!metadata?.sourceWebsite) {
      errors.push('Missing required field: sourceWebsite');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Detect if the URL is a chapter page (not a series page)
   * 
   * @param url - The URL to check
   * @returns true if this is a chapter page
   */
  isChapterPage(url: string): boolean {
    // Common patterns for chapter pages, handling both /chapter/1 and /chapter-1
    return /\/(chapter|ch|episode|ep|read)[/-]\d+/i.test(url);
  }

  /**
   * Extract series URL from a chapter URL
   * Override this for website-specific logic
   *
   * @param chapterUrl - The chapter page URL
   * @returns The series page URL, or null if cannot be determined
   */
  getSeriesUrlFromChapter(chapterUrl: string): string | null {
    // Default implementation: remove chapter path
    const match = chapterUrl.match(/(.*)\/(chapter|ch|episode|ep|read)\/\d+/i);
    return match ? match[1] : null;
  }

  /**
   * Generate JavaScript injection code to extract the current chapter number
   * directly from a chapter page's DOM.
   *
   * Most adapters don't need this - `extractChapterNumber()` in mangaHelpers.ts
   * can usually pull the chapter number straight out of the URL (e.g.
   * `/chapter/194` or `/chapter-194`). Override this ONLY for websites whose
   * chapter URLs don't contain a usable numeric chapter (e.g. WeebCentral uses
   * opaque ULID chapter IDs like `/chapters/01JCV081KZ2EHN7KXTYJ04YNRF`), so
   * reading progress can still be tracked by reading the page content instead.
   *
   * The returned code must be a self-invoking expression (matching the style
   * of getInjectionScript()) that evaluates to a JSON string of the shape
   * `{ chapterNumber: string | null }`.
   *
   * @returns JavaScript code as a string, or null if not needed (default)
   */
  getChapterNumberScript(): string | null {
    return null;
  }

  /**
   * Construct the URL for a specific chapter number, given the series
   * (detail page) URL - used by the library/history "jump to the latest
   * chapter" action, which needs to open a chapter the reader has never
   * visited (so there's no cached `lastReadUrl` to fall back to).
   *
   * Only implement this where the chapter URL is mechanically derivable
   * from the series URL + a chapter number alone - e.g. a flat
   * `/slug/chapter-N` scheme. Several sites CAN'T support this at all:
   * WeebCentral and MangaDex use opaque per-chapter IDs (ULID/UUID) that
   * don't exist anywhere in the series URL or the chapter number itself;
   * MangaTaro's real chapter URL needs an internal chapter id looked up
   * through a tokened API call, not just string-building. For all of
   * those, leave this returning null (the default) - the caller falls
   * back to opening the series detail page instead of a guessed, likely
   * wrong, chapter URL.
   *
   * @param seriesUrl - The manga's detail page URL (e.g. Manga.sourceUrl)
   * @param chapterNumber - The chapter number to link to, as a string
   * @returns The chapter URL, or null if this site doesn't support it
   */
  getChapterUrl(_seriesUrl: string, _chapterNumber: string): string | null {
    return null;
  }
}
