import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';
import { DebugAdapter } from './DebugAdapter';
import { WebtoonsAdapter } from './WebtoonsAdapter';
import { MangaFireAdapter } from './MangaFireAdapter';
import { WeebCentralAdapter } from './WeebCentralAdapter';
import { ComizyAdapter } from './ComizyAdapter';
import { ManhuaPlusAdapter } from './ManhuaPlusAdapter';
import { MangaDexAdapter } from './MangaDexAdapter';
import { MangaFreakAdapter } from './MangaFreakAdapter';
import { MangaTaroAdapter } from './MangaTaroAdapter';
import { HiveToonsAdapter } from './HiveToonsAdapter';

/**
 * FACTORY PATTERN - Extractor Factory
 * 
 * Responsibilities:
 * - Register all available adapters
 * - Select the appropriate adapter for a given URL
 * - Provide a centralized point for adapter management
 * 
 * Adding a new website extractor:
 * 1. Create a new adapter class extending BaseWebsiteAdapter
 * 2. Import it here
 * 3. Add an instance to the adapters array in the constructor
 */
export class ExtractorFactory {
  private adapters: BaseWebsiteAdapter[] = [];

  constructor() {
    this.registerDefaultAdapters();
  }

  /**
   * Register all default website adapters
   * This is called automatically in the constructor
   */
  private registerDefaultAdapters(): void {
    // 🐛 DEBUG MODE: Uncomment to use DebugAdapter
    // this.register(new DebugAdapter());
    
    this.register(new WebtoonsAdapter());
    this.register(new MangaFireAdapter());
    this.register(new WeebCentralAdapter());
    this.register(new ComizyAdapter());
    this.register(new ManhuaPlusAdapter());
    this.register(new MangaDexAdapter());
    this.register(new MangaFreakAdapter());
    this.register(new MangaTaroAdapter());
    this.register(new HiveToonsAdapter());
  }

  /**
   * Register a new adapter
   * 
   * @param adapter - The adapter instance to register
   */
  register(adapter: BaseWebsiteAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Get the appropriate adapter for a given URL
   * 
   * @param url - The URL to find an adapter for
   * @returns The matching adapter, or null if no adapter can handle the URL
   */
  getAdapterForUrl(url: string): BaseWebsiteAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Check if any adapter can handle the given URL
   * 
   * @param url - The URL to check
   * @returns true if an adapter exists for this URL
   */
  canHandle(url: string): boolean {
    return this.getAdapterForUrl(url) !== null;
  }

  /**
   * Get all registered adapters
   * 
   * @returns Array of all registered adapters
   */
  getAllAdapters(): BaseWebsiteAdapter[] {
    return [...this.adapters];
  }

  /**
   * Get adapter by name
   * 
   * @param name - The name of the adapter to find
   * @returns The matching adapter, or null if not found
   */
  getAdapterByName(name: string): BaseWebsiteAdapter | null {
    return this.adapters.find(adapter => adapter.getName() === name) || null;
  }
}

// Singleton instance
export const extractorFactory = new ExtractorFactory();
