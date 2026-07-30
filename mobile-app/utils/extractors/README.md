# Metadata Extractors - Architecture

This directory contains the metadata extraction system using the **Adapter Pattern** and **Factory Pattern**.

## 📁 File Structure

```
extractors/
├── types.ts                    # MangaMetadata interface
├── BaseWebsiteAdapter.ts       # Abstract base class
├── ExtractorFactory.ts         # Factory for adapter selection
├── metadataParser.ts           # JSON parsing utility
├── MangaDexAdapter.ts          # MangaDex extractor
├── MangaPlusAdapter.ts         # MangaPlus extractor
├── WebtoonsAdapter.ts          # Webtoons extractor
├── AsuraScansAdapter.ts        # AsuraScans extractor
├── MangaFireAdapter.ts         # MangaFire extractor
└── MangaKakalotAdapter.ts      # MangaKakalot extractor
```

## 🏗️ Architecture

### 1. **BaseWebsiteAdapter** (Abstract Class)
Defines the contract for all website extractors:
- `getName()`: Website name
- `getUrlPatterns()`: URL regex patterns
- `getInjectionScript()`: JavaScript injection code
- `canHandle(url)`: Check if adapter can handle URL
- `validateMetadata(data)`: Validate extracted data

### 2. **Concrete Adapters**
Each website has its own adapter class:
- Extends `BaseWebsiteAdapter`
- Implements website-specific DOM selectors
- Returns standardized `MangaMetadata`

### 3. **ExtractorFactory** (Singleton)
- Auto-registers all adapters
- Selects appropriate adapter for URL
- Provides centralized access point

### 4. **Utility Functions**
- `getExtractorForUrl(url)`: Get adapter for URL
- `isMangaDetailPage(url)`: Check if URL is supported
- `parseMetadata(json)`: Parse and validate JSON response

## 🚀 Adding a New Website

### Step 1: Create Adapter File
Create `[WebsiteName]Adapter.ts`:

```typescript
import { BaseWebsiteAdapter } from './BaseWebsiteAdapter';

export class MyWebsiteAdapter extends BaseWebsiteAdapter {
  getName(): string {
    return 'MyWebsite';
  }

  getUrlPatterns(): RegExp[] {
    return [/mywebsite\.com\/manga/i];
  }

  getInjectionScript(): string {
    return `
      (function() {
        try {
          const data = {};
          
          // Extract title
          const titleEl = document.querySelector('h1.title');
          data.title = titleEl ? titleEl.textContent.trim() : '';
          
          // Extract other fields...
          data.sourceUrl = window.location.href;
          data.sourceWebsite = 'MyWebsite';
          
          return JSON.stringify(data);
        } catch(e) {
          return JSON.stringify({ error: e.message });
        }
      })();
    `;
  }
}
```

### Step 2: Register in Factory
Edit `ExtractorFactory.ts`:

```typescript
import { MyWebsiteAdapter } from './MyWebsiteAdapter';

private registerDefaultAdapters(): void {
  // ... existing adapters
  this.register(new MyWebsiteAdapter());
}
```

### Step 3: Export from Main File
Edit `../metadataExtractors.ts`:

```typescript
export { MyWebsiteAdapter } from './extractors/MyWebsiteAdapter';
```

**That's it!** The factory will automatically use your new adapter.

## 🎯 Design Principles

### Single Responsibility Principle (SRP)
- Each adapter handles ONE website
- Each file has ONE clear purpose

### Open/Closed Principle (OCP)
- Open for extension (add new adapters)
- Closed for modification (no need to change existing code)

### Liskov Substitution Principle (LSP)
- All adapters are interchangeable
- Factory works with any BaseWebsiteAdapter

### Dependency Inversion Principle (DIP)
- High-level code depends on BaseWebsiteAdapter abstraction
- Low-level adapters implement the abstraction

## 📝 Usage Example

```typescript
import { getExtractorForUrl, isMangaDetailPage, parseMetadata } from '../utils/metadataExtractors';

// Check if URL is supported
if (isMangaDetailPage(url)) {
  // Get appropriate adapter
  const adapter = getExtractorForUrl(url);
  
  // Get injection script
  const script = adapter.getInjectionScript();
  
  // Inject into WebView and receive response
  const jsonResponse = await webView.injectJavaScript(script);
  
  // Parse metadata
  const metadata = parseMetadata(jsonResponse);
  
  if (metadata) {
    console.log('Title:', metadata.title);
    console.log('Author:', metadata.author);
    // ... use metadata
  }
}
```

## 🧪 Testing New Adapters

1. Test URL pattern matching
2. Test JavaScript injection on actual website
3. Verify all metadata fields are extracted
4. Handle edge cases (missing fields, errors)
5. Validate against `MangaMetadata` interface
