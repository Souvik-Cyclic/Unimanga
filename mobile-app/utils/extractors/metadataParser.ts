import type { MangaMetadata } from './types';

/**
 * Parse extracted metadata from WebView message
 * 
 * @param jsonString - JSON string returned from WebView JavaScript injection
 * @returns Parsed and validated MangaMetadata, or null if invalid
 */
export const parseMetadata = (jsonString: string): MangaMetadata | null => {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.error || !data.title) {
      console.log('Metadata extraction error:', data.error || 'No title found');
      return null;
    }
    
    // Validate required fields
    if (!data.sourceUrl || !data.sourceWebsite) {
      console.log('Missing required metadata fields');
      return null;
    }
    
    return data as MangaMetadata;
  } catch (error) {
    console.log('Failed to parse metadata:', error);
    return null;
  }
};
