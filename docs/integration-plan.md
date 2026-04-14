# Plan: Integration of obsidian-clipper features into AuthClip

## 1. Current State Analysis

### AuthClip (current project)
- **Architecture**: pnpm monorepo — `packages/shared-types`, `apps/clipper-fork`, `apps/obsidian-plugin`
- **Content extraction**: Basic custom HTML-to-Markdown converter in `extractPageContent()` (background.ts:124-224) — handles only headings, bold/italic, code, links, images, lists, blockquotes
- **Image handling**: Discovers `img[src]`, `img[srcset]`, `picture source[srcset]`, downloads with cookies — this is AuthClip's core value and is **working well**
- **UI**: Minimal popup with port/token config + single "Clip with Assets" button
- **Transport**: HTTP POST to Obsidian plugin (localhost)
- **No**: content selection, highlighter, templates, shadow DOM handling, text selection clipping, Schema.org extraction

### obsidian-clipper (upstream)
- **Architecture**: Single browser extension, uses `obsidian://` URI scheme (no companion plugin)
- **Content extraction**: Defuddle library — handles article detection, metadata, HTML-to-Markdown, URL resolution
- **Clipping regions**: 4 mechanisms — full page, text selection, highlighter mode, CSS selector extraction
- **Format preservation**: Defuddle + URL resolution + Shadow DOM flattening + DOMPurify
- **Template engine**: Full tokenizer/parser/renderer with 50+ filters, AI prompts, if/else, for loops
- **No**: local image downloading (Obsidian downloads server-side) — this is why AuthClip exists

### Gap Analysis

| Feature | AuthClip | obsidian-clipper | Priority |
|---------|----------|------------------|----------|
| Auth-aware image download | ✅ | ❌ | — (keep) |
| Quality HTML→Markdown | ❌ basic | ✅ Defuddle | **P0** |
| Text selection clipping | ❌ | ✅ | **P0** |
| Clipping region selector | ❌ | ✅ highlighter | **P1** |
| URL resolution (relative→abs) | ❌ partial | ✅ full | **P0** |
| Shadow DOM flattening | ❌ | ✅ | **P1** |
| Template engine | ❌ | ✅ full | **P2** |
| Schema.org metadata | ❌ | ✅ | **P2** |
| CSS selector extraction | ❌ | ✅ | **P2** |

## 2. Architectural Changes Required

### 2.1. Content Script Injection (Critical Change)

**Current**: `chrome.scripting.executeScript({ func: extractPageContent })` — injects a function on-demand when user clicks "Clip".

**Problem**: Cannot support highlighter mode, text selection detection, or shadow DOM flattening, which require persistent DOM listeners.

**New approach**: Register a persistent content script via `chrome.scripting.registerContentScripts()` on extension install. The content script will:
- Flatten shadow DOM on page load
- Listen for highlighter mode activation
- Detect text selections
- Respond to extraction requests from the background script

**Files affected**: 
- `extension-manifest.json` — add `content_scripts` or use dynamic registration
- New file: `src/content.ts` — persistent content script
- `src/background.ts` — change from `executeScript(func:)` to messaging-based extraction

### 2.2. Defuddle Integration

**Change**: Add `defuddle` npm package as dependency to clipper-fork. Bundle it via esbuild (already bundles dependencies). Replace `extractPageContent()`'s custom `elementToMd()` with Defuddle's `createMarkdownContent()`.

**Impact**: Much better HTML-to-Markdown conversion — handles tables, nested structures, code blocks with language detection, etc.

**Files affected**:
- `apps/clipper-fork/package.json` — add `defuddle` dependency
- New file: `src/content-extractor.ts` — extraction logic using Defuddle
- `src/content.ts` — new content script that uses Defuddle
- `src/background.ts` — simplify to message routing

### 2.3. Build System Changes

**Current**: esbuild bundles background.ts and popup.ts as IIFE bundles.

**New entries needed**:
- `src/content.ts` → `content.js` (content script, IIFE bundle with Defuddle inlined)
- Popup stays the same

**esbuild.config.mjs** needs a third build entry for the content script.

## 3. Implementation Plan

### Phase 1: Core Content Extraction Upgrade (P0)

#### Step 1.1: Clone obsidian-clipper as reference
- Clone `https://github.com/obsidianmd/obsidian-clipper` to a sibling directory (not inside the monorepo) for reference
- We will **port** selected code, not copy the whole project

#### Step 1.2: Add Defuddle dependency
- Add `defuddle` to `apps/clipper-fork/package.json`
- Add `dompurify` to `apps/clipper-fork/package.json`

#### Step 1.3: Create content script (`src/content.ts`)
Port from obsidian-clipper's `content.ts`:
- Shadow DOM flattening (from `flatten-shadow-dom.js` + injection logic)
- URL resolution: convert all `[src]`, `[href]`, `[srcset]` to absolute URLs before extraction
- DOMPurify sanitization
- Defuddle-based content extraction with metadata (author, date, description, image, site_name, etc.)
- Text selection detection via `window.getSelection()`
- Message handler that responds to background script requests

The content script returns structured data:
```typescript
interface PageContent {
  title: string;
  url: string;
  markdown: string;
  fullHtml: string;
  selectedHtml?: string;
  selection?: string;
  imageUrls: string[];
  meta: {
    author?: string;
    description?: string;
    published?: string;
    siteName?: string;
    domain?: string;
    favicon?: string;
    image?: string;
    language?: string;
  };
}
```

#### Step 1.4: Update background.ts
- Remove inline `extractPageContent()` function
- Change from `chrome.scripting.executeScript({ func: ... })` to sending a message to the content script
- Handle text selection mode (if user selected text, clip only selection)

#### Step 1.5: Update build system
- Add content script entry to `esbuild.config.mjs`
- Update `extension-manifest.json` with content script registration
- Add `storage` permission (needed for settings persistence)

#### Step 1.6: Update shared types
- Extend `CapturePackage` to carry metadata (author, description, published, etc.)
- Add text selection fields to the package

#### Step 1.7: Update Obsidian plugin
- Update frontmatter generation to include new metadata fields
- No changes to attachment handling (already works)

### Phase 2: Clipping Region Selector / Highlighter (P1)

#### Step 2.1: Port highlighter engine
From obsidian-clipper's `highlighter.ts`:
- Text highlighting with XPath + offsets
- Element highlighting (images, etc.)
- Overlay rendering
- Undo/redo history
- Storage persistence via `chrome.storage.local`

#### Step 2.2: Add highlighter UI to content script
- Click-drag text selection → highlight
- Right-click element → highlight
- Visual overlays on highlighted regions

#### Step 2.3: Update popup UI
- Add "Highlighter" toggle button
- Show highlight count
- Highlight behavior options (replace content, inline mark, ignore)

#### Step 2.4: Integration with clipping flow
- When clipping with highlights: extract only highlighted content
- When clipping with highlights + inline: wrap highlights in `<mark>` tags

### Phase 3: Template Engine (P2)

#### Step 3.1: Create new shared package `@authclip/template-engine`
Port from obsidian-clipper's tokenizer/parser/renderer:
- `tokenizer.ts` → tokenize template strings
- `parser.ts` → build AST (TextNode, VariableNode, IfNode, ForNode, SetNode)
- `renderer.ts` → evaluate AST against variable context
- Basic filters: `lower`, `upper`, `trim`, `date`, `safe_name`, `markdown`, `slice`, `default`, `replace`, `strip_tags`

#### Step 3.2: Add preset variables
From obsidian-clipper's `shared.ts::buildVariables()`:
- `title`, `content`, `url`, `author`, `date`, `description`, `domain`, `site`, `image`, `language`, `published`, `selection`, `selectionHtml`, `fullHtml`, `words`
- `meta:*` variables for meta tag extraction

#### Step 3.3: Add template storage and UI
- Template CRUD in extension settings
- Trigger-based URL matching
- Note name format template
- Note content format template
- Folder path template

#### Step 3.4: Update popup UI
- Template selector dropdown
- Quick template switching
- Basic template editor

## 4. Files to Create/Modify

### New files
```
apps/clipper-fork/src/content.ts                    # Persistent content script
apps/clipper-fork/src/content-extractor.ts           # Extraction logic (Defuddle-based)
apps/clipper-fork/src/flatten-shadow-dom.ts          # Shadow DOM flattening
apps/clipper-fork/src/highlighter.ts                 # Highlighter engine
apps/clipper-fork/src/highlighter-overlays.ts        # Visual overlay rendering
apps/clipper-fork/src/settings.ts                    # Extension settings management
packages/template-engine/                            # Template engine package (Phase 3)
```

### Modified files
```
apps/clipper-fork/package.json                       # Add defuddle, dompurify deps
apps/clipper-fork/extension-manifest.json             # Add content script, storage perm
apps/clipper-fork/esbuild.config.mjs                 # Add content script build entry
apps/clipper-fork/src/background.ts                  # Message-based extraction
apps/clipper-fork/src/popup.ts                       # Enhanced UI
apps/clipper-fork/popup.html                         # Enhanced UI layout
packages/shared-types/src/capture-package.ts          # Extended metadata fields
packages/shared-types/src/schemas.ts                  # Updated schemas
apps/obsidian-plugin/src/clip-transaction.ts          # Extended frontmatter
apps/obsidian-plugin/src/settings-tab.ts              # New settings
```

## 5. What Stays the Same

These parts of AuthClip are **working and should not be changed**:
- **HTTP transport** (`transport.ts`, `http-server.ts`) — the localhost communication
- **Asset fetching with cookies** (`asset-discovery-wrapper.ts`, `asset-fetcher.ts`) — AuthClip's core differentiator
- **Attachment writing** (`attachment-writer.ts`) — base64 decode + vault write
- **Markdown rewriting** (`markdown-rewriter.ts`) — URL → local link conversion
- **Path resolution** (`path-resolver.ts`) — note/attachment path strategies
- **Zod validation** (`manifest-validator.ts`, `schemas.ts`) — runtime validation
- **Graceful degradation** — partial success model
- **Build system for Obsidian plugin** — unchanged

## 6. Dependency Changes

### apps/clipper-fork new dependencies
```json
{
  "defuddle": "^0.16.0",
  "dompurify": "^3.0.9"
}
```

### Potential new shared package (Phase 3)
```json
{
  "@authclip/template-engine": "workspace:*"
}
```

## 7. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Defuddle bundle size (~large library) | webpack tree-shaking + code splitting; content script loaded per-page, not in popup |
| Content script conflicts with existing page scripts | Use `world: "ISOLATED"` for main logic, inject shadow DOM flattening in `MAIN` world |
| Highlighter complexity (Phase 2) | Start with text selection only; add element highlighting incrementally |
| Template engine scope creep (Phase 3) | Start with 10 essential filters, add more on demand |
| Breaking changes to CapturePackage format | Version bump protocol; plugin handles both v1.0 and v1.1 |
| webpack migration breaking existing builds | Migrate incrementally: first background+popup, then content script, then styles |

## 8. Execution Order

1. **Clone obsidian-clipper** as reference → `D:\git\obsidian\_reference\obsidian-clipper`
2. **Switch build system** from esbuild to webpack (both clipper-fork and obsidian-plugin)
3. **Phase 1 (P0)** — Content extraction upgrade (Defuddle + content script + URL resolution + shadow DOM + text selection)
4. **Phase 2 (P1)** — Highlighter mode (after Phase 1 is tested)
5. **Phase 3 (P2)** — Template engine package (after Phase 2 is tested)

All 3 phases will be implemented.

## 9. Build System Migration: esbuild → webpack

### Why webpack
- Parity with obsidian-clipper upstream for easier future rebasing
- Better support for multiple entry points (background, popup, content script, highlighter styles)
- CSS/SCSS support out of the box
- CopyWebpackPlugin for static assets
- More mature plugin ecosystem

### Migration steps

#### 9.1. Install webpack dependencies
```bash
cd apps/clipper-fork
pnpm add -D webpack webpack-cli ts-loader css-loader style-loader mini-css-extract-plugin copy-webpack-plugin terser-webpack-plugin
```

#### 9.2. Create `webpack.config.mjs` for clipper-fork
```javascript
entry: {
  background: './src/background.ts',
  popup: './src/popup.ts',
  content: './src/content.ts',
  style: './src/styles.scss',
  highlighter: './src/highlighter.scss',
}
output: { path: 'dist-extension/', filename: '[name].js' }
// ts-loader for TypeScript
// CopyWebpackPlugin for popup.html, manifest.json, icons
```

#### 9.3. Update clipper-fork package.json scripts
```json
{
  "build:extension": "webpack --config webpack.config.mjs",
  "build": "tsc",
  "dev:extension": "webpack --watch --config webpack.config.mjs"
}
```

#### 9.4. Migrate obsidian-plugin webpack (optional)
The Obsidian plugin build is simpler (single entry). Could stay on esbuild since it only produces one file. Recommend keeping esbuild for the plugin and only migrating the extension to webpack.

#### 9.5. Update esbuild.config.mjs → remove or keep as fallback
Remove `esbuild.config.mjs` from clipper-fork after webpack works.
Keep `esbuild.config.mjs` in obsidian-plugin.

### New webpack entries for Phase 2+ (highlighter)
When highlighter is added:
- `highlighter` entry → `highlighter.js` (content script for highlighter)
- `highlighter-style` entry → `highlighter.css` (overlay styles)
- `reader` entry → `reader.js` (reader mode, future)
