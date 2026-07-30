import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

/**
 * Webtoons Adapter
 * 
 * Supports: https://www.webtoons.com/[language]/[genre]/[series]/list
 * 
 * Features:
 * - Vertical scroll format
 * - Multi-language support
 * - Original content and licensed titles
 */
export class WebtoonsAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'Webtoons';
  }

  getUrlPatterns(): RegExp[] {
    return [
      /webtoons\.com\/[a-z]+\/[a-z-]+\/[a-z0-9-]+/i,
    ];
  }

  /**
   * Detect if the URL is a chapter page
   * Webtoons chapter URLs contain /viewer?title_no= or /episode/
   */
  isChapterPage(url: string): boolean {
    return /viewer\?title_no=|\/episode\//i.test(url);
  }

  /**
   * Extract series URL from chapter URL
   * Convert viewer/episode URL back to series list page
   */
  getSeriesUrlFromChapter(chapterUrl: string): string | null {
    // Example: webtoons.com/en/genre/title/viewer?title_no=123&episode_no=456
    // Convert to: webtoons.com/en/genre/title/list?title_no=123
    
    const titleMatch = chapterUrl.match(/title_no=(\d+)/);
    if (titleMatch) {
      // If we have title_no, construct the list URL
      const baseUrl = chapterUrl.split('/viewer')[0].split('/episode')[0];
      return `${baseUrl}/list?title_no=${titleMatch[1]}`;
    }
    
    return null;
  }

  getInjectionScript(): string {
    return `
      (function() {
        try {
          const data = {};
          const debug = { attempts: {} };
          
          // Title - Try multiple selectors
          let title = '';
          const titleSelectors = [
            'h1.subj',
            'h1._title', 
            '.info h1',
            '.detail_header h1',
            'h1[class*="title"]',
            'h1'
          ];
          
          for (const selector of titleSelectors) {
            const el = document.querySelector(selector);
            debug.attempts[selector] = el ? el.textContent.trim() : 'not found';
            if (el && el.textContent.trim()) {
              title = el.textContent.trim();
              debug.titleSource = selector;
              break;
            }
          }
          
          // Fallback to meta tag
          if (!title) {
            const metaTitle = document.querySelector('meta[property="og:title"]');
            debug.attempts['meta[property="og:title"]'] = metaTitle ? metaTitle.content : 'not found';
            title = metaTitle ? metaTitle.content.replace(' | WEBTOON', '').trim() : '';
            if (title) debug.titleSource = 'meta[property="og:title"]';
          }
          
          // Final fallback to document.title
          if (!title && document.title) {
            debug.attempts['document.title'] = document.title;
            title = document.title
              .replace(' | WEBTOON', '')
              .replace('WEBTOON', '')
              .split('|')[0]
              .split('-')[0]
              .trim();
            if (title) debug.titleSource = 'document.title';
          }
          
          data.title = title;
          data._debug = debug;
          
          // Description - Try multiple approaches
          let description = '';
          const descSelectors = [
            'p.summary',
            'p._summary',
            '.summary',
            '.detail_body p',
            'p[class*="summary"]',
            'p[class*="description"]'
          ];
          
          for (const selector of descSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim() && el.textContent.trim().length > 20) {
              description = el.textContent.trim();
              break;
            }
          }
          
          // Fallback to meta description
          if (!description) {
            const metaDesc = document.querySelector('meta[property="og:description"]') || 
                            document.querySelector('meta[name="description"]');
            description = metaDesc ? metaDesc.content : '';
          }
          
          data.description = description.substring(0, 500);
          
          // Cover Image - Try multiple selectors
          let coverImage = '';
          const imageSelectors = [
            'img.thumb',
            'span._thumbnail img',
            '.detail_header img',
            '.detail_body img',
            'img[class*="thumb"]',
            'img[class*="cover"]'
          ];
          
          for (const selector of imageSelectors) {
            const el = document.querySelector(selector);
            if (el && el.src && !el.src.includes('logo') && !el.src.includes('blank')) {
              coverImage = el.src;
              break;
            }
          }
          
          // Fallback to meta image
          if (!coverImage) {
            const metaImg = document.querySelector('meta[property="og:image"]');
            coverImage = metaImg ? metaImg.content : '';
          }
          
          data.coverImage = coverImage;
          
          // Author - Try multiple selectors
          let author = '';
          const authorSelectors = [
            '.author',
            '._authorName',
            '.detail_header .author',
            'a[href*="/creator/"]',
            '.creator_name'
          ];
          
          for (const selector of authorSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim()) {
              author = el.textContent
                .trim()
                .replace('author info', '')
                .replace('author', '')
                .replace(/\s+/g, ' ')
                .replace(/,\s*$/g, '')
                .trim();
              break;
            }
          }
          
          data.author = author;
          
          // Genre - Try multiple selectors
          let genre = 'Webtoon';
          const genreSelectors = [
            '.genre',
            'h2._genre',
            '.info .genre',
            'span.genre',
            'a[href*="/genre/"]'
          ];
          
          for (const selector of genreSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim()) {
              genre = el.textContent.trim();
              break;
            }
          }
          
          data.genres = [genre, 'Webtoon'];
          
          // Status - Try multiple selectors
          let status = 'ongoing';
          const statusSelectors = [
            '.day_info',
            '._statusText',
            '.info .status',
            'span[class*="status"]'
          ];
          
          for (const selector of statusSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              const statusText = el.textContent.toLowerCase();
              if (statusText.includes('completed') || statusText.includes('complete') || statusText.includes('finished')) {
                status = 'completed';
              }
              break;
            }
          }
          
          data.mangaStatus = status;
          
          // Clean up URL
          let cleanUrl = window.location.href.split('?')[0];
          if (!cleanUrl.endsWith('/list')) {
            cleanUrl = cleanUrl.split('/list')[0] + '/list';
          }
          
          data.sourceUrl = cleanUrl;
          data.sourceWebsite = 'Webtoons';
          
          return JSON.stringify(data);
        } catch(e) {
          return JSON.stringify({ error: e.message, stack: e.stack });
        }
      })();
    `;
  }
}
