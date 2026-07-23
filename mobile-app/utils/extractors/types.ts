/**
 * Domain Models and Types
 */

export interface MangaMetadata {
  title: string;
  description?: string;
  author?: string;
  artist?: string;
  coverImage?: string;
  sourceWebsite: string;
  sourceUrl: string;
  genres?: string[];
  mangaStatus?: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  totalChapters?: number;
  alternativeTitles?: string[];
  lastChapterAdded?: string;
  rating?: number;
}
