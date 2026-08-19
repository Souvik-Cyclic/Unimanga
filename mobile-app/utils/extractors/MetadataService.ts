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
        }
      })();
      true;
    `;
  }

  /**
   * Parse and validate metadata from WebView message
   * 
   * @param jsonString - The JSON string received from the WebView
   * @returns Parsed and validated metadata, or null if invalid
   */
  parseMetadata(jsonString: string): MangaMetadata | null {
    try {
      console.log('[MetadataService] Parsing metadata...');

      if (!jsonString || typeof jsonString !== 'string') {
        console.log('[MetadataService] Invalid input: not a string');
        return null;
      }

      const data = JSON.parse(jsonString);

      // 🐛 DEBUG MODE: If this is debug output, log it and return null
      if (data._isDebugAdapter) {
        console.log('==========================================');
        console.log('🐛 DEBUG ADAPTER OUTPUT:');
        console.log('==========================================');
        console.log(JSON.stringify(data, null, 2));
        console.log('==========================================');
        return null;
      }

      // Handle redirection response (from chapter pages)
      if (data._redirecting) {
        console.log('[MetadataService]', data.message || 'Redirecting...');
        return null;
      }

      if (data.error) {
        console.log('[MetadataService] Extraction error from page:', data.error);
        return null;
      }

      // Validate required fields
      if (!data.title) {
        console.log('[MetadataService] No title found in extracted data');
        if (data._debug) {
          console.log('[MetadataService] Debug info:', JSON.stringify(data._debug, null, 2));
        }
        console.log('[MetadataService] Full extracted data:', JSON.stringify(data, null, 2));
        return null;
      }

      if (!data.sourceUrl || !data.sourceWebsite) {
        console.log('[MetadataService] Missing required fields (sourceUrl or sourceWebsite)');
        return null;
      }

      // Additional validation using adapter if available
      const adapter = this.getExtractorForUrl(data.sourceUrl);
      if (adapter) {
        const validationResult = adapter.validateMetadata(data);
        if (!validationResult.isValid) {
          console.log('[MetadataService] Metadata validation failed:', validationResult.errors);
          // Still return the data but log the issues
        }
      }

      console.log('[MetadataService] Successfully parsed metadata for:', data.title);
      return data as MangaMetadata;
    } catch (error) {
      console.log('[MetadataService] Failed to parse metadata JSON:', error);
      return null;
    }
  }

  /**
   * Get all registered adapters
   * Useful for debugging or showing supported websites
   * 
   * @returns Array of all registered adapters
   */
  getAllAdapters(): BaseWebsiteAdapter[] {
    return extractorFactory.getAllAdapters();
  }

  /**
   * Get supported website names
   * 
   * @returns Array of website names that can be extracted
   */
  getSupportedWebsites(): string[] {
    return this.getAllAdapters().map(adapter => adapter.getName());
  }

  /**
   * Get adapter by website name
   * 
   * @param name - The name of the website
   * @returns The matching adapter, or null if not found
   */
  getAdapterByName(name: string): BaseWebsiteAdapter | null {
    return extractorFactory.getAdapterByName(name);
  }
}

// Export singleton instance
export const metadataService = MetadataService.getInstance();
