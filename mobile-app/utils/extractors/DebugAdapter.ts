import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

/**
 * Debug Adapter - USE THIS TO INSPECT ANY WEBSITE
 * 
 * This adapter extracts ALL common selectors and logs them
 * Use this to find the right selectors for a new website
 * 
 * How to use:
 * 1. Temporarily register this in ExtractorFactory for the target website
 * 2. Navigate to manga page
 * 3. Click "Add to Library"
 * 4. Check React Native logs to see what was found
 * 5. Copy the working selectors to the real adapter
 */
export class DebugAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'Debug';
  }

  getUrlPatterns(): RegExp[] {
    // Match ANY URL
    return [/.*/];
  }

  getInjectionScript(): string {
    return `
      (function() {
        try {
          const debug = {
            url: window.location.href,
            selectors: {}
          };
          
          // === TITLE SELECTORS ===
          const titleSelectors = [
            'h1',
            'h1.title',
            'h1.entry-title',
            'h1.post-title',
            'h1.name',
            'h1.subj',
            '[class*="title"]',
            '[class*="Title"]',
            '.series-title',
            '.manga-title',
            '.comic-title'
          ];
          
          debug.selectors.titles = {};
          titleSelectors.forEach(selector => {
            try {
              const el = document.querySelector(selector);
              if (el) {
                debug.selectors.titles[selector] = el.textContent.trim();
              }
            } catch(e) {}
          });
          
          // === DESCRIPTION SELECTORS ===
          const descSelectors = [
            '.description',
            '.summary',
            '.synopsis',
            '[class*="desc"]',
            '[class*="summary"]',
            'p.summary',
            '.content p',
            '[itemprop="description"]'
          ];
          
          debug.selectors.descriptions = {};
          descSelectors.forEach(selector => {
            try {
              const el = document.querySelector(selector);
              if (el) {
                const text = el.textContent.trim().substring(0, 100);
                debug.selectors.descriptions[selector] = text + '...';
              }
            } catch(e) {}
          });
          
          // === IMAGE SELECTORS ===
          debug.selectors.images = [];
          const images = Array.from(document.querySelectorAll('img'));
          images.slice(0, 10).forEach((img, i) => {
            debug.selectors.images.push({
              index: i,
              src: img.src,
              alt: img.alt || '',
              width: img.width,
              height: img.height,
              classes: img.className
            });
          });
          
          // === META TAGS ===
          debug.meta = {
            ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
            ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
            ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
            description: document.querySelector('meta[name="description"]')?.content || ''
          };
          
          // === AUTHOR SELECTORS ===
          const authorSelectors = [
            '.author',
            '[class*="author"]',
            '[class*="Author"]',
            '.info-item:contains("Author")',
            '[itemprop="author"]'
          ];
          
          debug.selectors.authors = {};
          authorSelectors.forEach(selector => {
            try {
              const el = document.querySelector(selector);
              if (el) {
                debug.selectors.authors[selector] = el.textContent.trim();
              }
            } catch(e) {}
          });
          
          // === GENRE SELECTORS ===
          const genreSelectors = [
            '.genres a',
            '.genre a',
            'a[href*="genre"]',
            '[class*="genre"] a',
            '.badge',
            '.tag'
          ];
          
          debug.selectors.genres = {};
          genreSelectors.forEach(selector => {
            try {
              const els = document.querySelectorAll(selector);
              if (els.length > 0) {
                debug.selectors.genres[selector] = Array.from(els)
                  .map(el => el.textContent.trim())
                  .filter(Boolean)
                  .slice(0, 5);
              }
            } catch(e) {}
          });
          
          // === STATUS SELECTORS ===
          const statusSelectors = [
            '.status',
            '[class*="status"]',
            '[class*="Status"]',
            '.info-status',
            '[data-status]'
          ];
          
          debug.selectors.statuses = {};
          statusSelectors.forEach(selector => {
            try {
              const el = document.querySelector(selector);
              if (el) {
                debug.selectors.statuses[selector] = el.textContent.trim();
              }
            } catch(e) {}
          });
          
          // Add a clear marker for debugging
          debug._isDebugAdapter = true;
          debug._instruction = 'CHECK CONSOLE LOGS - Look for selectors that have values and use them in your adapter!';
          
          return JSON.stringify(debug, null, 2);
        } catch(e) {
          return JSON.stringify({ 
            error: e.message,
            _isDebugAdapter: true 
          });
        }
      })();
    `;
  }
}
