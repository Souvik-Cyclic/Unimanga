/**
 * MetadataService - Facade for Metadata Extraction
 * 
 * Provides a clean, simple API for extracting manga metadata from websites.
 * Uses the Factory pattern internally to select the appropriate adapter.
 * Handles parsing, validation, and error recovery.
 * 
 * @example
 * const service = MetadataService.getInstance();
 * const adapter = service.getExtractorForUrl(url);
 * if (adapter) {
 *   const script = service.getInjectionScript(url);
 *   // Inject script into WebView
 * }
 */

import { extractorFactory } from './ExtractorFactory';
import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';
import { MangaMetadata } from './types';

export class MetadataService {
  private static instance: MetadataService;

  private constructor() { }

  /**
   * Get singleton instance
   */
  static getInstance(): MetadataService {
    if (!MetadataService.instance) {
      MetadataService.instance = new MetadataService();
    }
    return MetadataService.instance;
  }

  /**
   * Get the appropriate extractor adapter for a given URL
   * 
   * @param url - The URL to find an adapter for
   * @returns The matching adapter, or null if no adapter can handle the URL
   */
  getExtractorForUrl(url: string): BaseWebsiteAdapter | null {
    try {
      return extractorFactory.getAdapterForUrl(url);
    } catch (error) {
      console.log('[MetadataService] Error getting adapter for URL:', url, error);
      return null;
    }
  }

  /**
   * Check if the URL is a manga detail page that can be extracted
   * 
   * @param url - The URL to check
   * @returns true if an adapter exists for this URL
   */
  isMangaDetailPage(url: string): boolean {
    const adapter = this.getExtractorForUrl(url);
    if (!adapter) return false;

    // NOTE: chapter pages are intentionally NOT treated as extractable here.
    // getInjectionScript() below explicitly refuses to run its extraction
    // script on chapter pages (the user is reading, not browsing a detail
    // page) - claiming otherwise here used to make callers believe
    // extraction would work on a chapter page when it never could, causing
    // a silent extract-fails-every-time loop. Callers that want to support
    // "add to library while reading a chapter" should rely on metadata
    // already captured from an earlier visit to the series page instead.
    return adapter.isMangaDetailPage(url);
  }

  /**
   * Get the injection script for a given URL
   * Wraps the adapter's script to handle WebView messaging
   * 
   * @param url - The URL to get the injection script for
   * @returns The complete injection script, or null if no adapter found
   */
  getInjectionScript(url: string): string | null {
    const adapter = this.getExtractorForUrl(url);
    if (!adapter) {
      console.warn('[MetadataService] No adapter found for URL:', url);
      return null;
    }

    // If this is a chapter page, don't extract metadata (user is reading)
    if (adapter.isChapterPage(url)) {
      console.log('[MetadataService] Chapter page detected, skipping metadata extraction (user is reading)');
      return null;
    }

    const baseScript = adapter.getInjectionScript();

    // Wrap the adapter's script to handle WebView communication
    return `
      (function() {
        try {
          const result = ${baseScript};
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(result);
          }
          return result;
        } catch(e) {
          console.log('[MetadataExtraction] Error:', e);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ error: e.message }));
          }
          return JSON.stringify({ error: e.message });
