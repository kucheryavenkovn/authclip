# PRD: HTML-to-Markdown Conversion & Image Handling — Comparative Analysis

> **Scope**: Upstream Obsidian Web Clipper v1.4.0 vs. authclip fork (clipper-fork + obsidian-plugin).
> **Purpose**: Reference document for understanding how each system converts page content to Markdown and handles images.

---

## 1. File Inventory

### Upstream Obsidian Web Clipper v1.4.0 (`_reference/obsidian-clipper/`)

| File | Path | Relevance |
|------|------|-----------|
| Markdown filter | `src/utils/filters/markdown.ts` | Primary HTML-to-Markdown conversion |
| Content extractor | `src/utils/content-extractor.ts` | Orchestrates extraction + markdown conversion |
| Content script | `src/content.ts` | Page content extraction pipeline |
| Reader | `src/utils/reader.ts` | Reader mode content extraction |
| Image filter | `src/utils/filters/image.ts` | `{{image}}` variable to `![](url)` syntax |
| Link filter | `src/utils/filters/link.ts` | `{{url}}` to `[text](url)` syntax |
| Wikilink filter | `src/utils/filters/wikilink.ts` | `[[wikilink]]` syntax |
| Strip tags filter | `src/utils/filters/strip_tags.ts` | HTML tag stripping |
| Strip markdown filter | `src/utils/filters/strip_md.ts` | Markdown syntax stripping |
| Remove HTML filter | `src/utils/filters/remove_html.ts` | Remove specific HTML elements |
| Shared utils | `src/utils/shared.ts` | `buildVariables()` — variable dict construction |
| Template compiler | `src/utils/template-compiler.ts` | Template compilation pipeline |
| Renderer | `src/utils/renderer.ts` | AST rendering + filter application |
| Parser | `src/utils/parser.ts` | Template AST parser |
| Note creator | `src/utils/obsidian-note-creator.ts` | Obsidian URI protocol note saving |

### Fork (`apps/clipper-fork/`)

| File | Path | Relevance |
|------|------|-----------|
| HTML-to-Markdown | `src/html-to-markdown.ts` | **Custom** HTML-to-Markdown converter |
| Content script | `src/content.ts` | Page content extraction pipeline |
| Background script | `src/background.ts` | Clip orchestration + template rendering |
| Asset discovery | `src/asset-discovery.ts` | DOM image asset discovery |
| Asset discovery wrapper | `src/asset-discovery-wrapper.ts` | Asset fetching wrapper |
| Asset fetcher | `src/asset-fetcher.ts` | Concurrent image downloading |
| Package builder | `src/package-builder.ts` | CapturePackage assembly |
| Transport | `src/transport.ts` | HTTP delivery to plugin |
| DOM utils | `src/dom-utils.ts` | XPath utilities |

### Obsidian Plugin (`apps/obsidian-plugin/`)

| File | Path | Relevance |
|------|------|-----------|
| Markdown rewriter | `src/markdown-rewriter.ts` | URL-to-local-path rewriting in markdown |
| Attachment writer | `src/attachment-writer.ts` | Binary file writing to vault |
| Clip transaction | `src/clip-transaction.ts` | Full clip orchestration |
| HTTP server | `src/http-server.ts` | Receives CapturePackages |
| Path resolver | `src/path-resolver.ts` | Note/attachment path computation |
| Main plugin | `src/main.ts` | Plugin lifecycle |

### Shared Template Engine (`packages/template-engine/`)

| File | Path | Relevance |
|------|------|-----------|
| Barrel | `src/index.ts` | Re-exports `buildVariables`, `render` |
| Markdown filter | `src/filters/markdown.ts` | Same `defuddle/full` `createMarkdownContent` call |

---

## 2. Pipeline Comparison

### 2A. Upstream Pipeline: How Page Content Becomes Markdown

**Step 1 — Content extraction** (`_reference/obsidian-clipper/src/content.ts`, lines 326–420):

1. Content script receives `"getPageContent"` message.
2. Runs `flattenShadowDom(document)` to flatten shadow DOM.
3. Creates `Defuddle(document, { url: document.URL })` and calls `defuddle.parseAsync()`.
4. Parses the document with `DOMParser`, removes `<script>` and `<style>`, resolves relative URLs to absolute.
5. Returns raw HTML in `content` field + metadata (title, author, etc.).
6. **No markdown conversion happens in the content script** — raw HTML is sent to the background/popup.

**Step 2 — Markdown conversion** (`_reference/obsidian-clipper/src/utils/content-extractor.ts`, lines 139–230):

1. `initializePageContent()` receives the raw HTML.
2. Calls `createMarkdownContent(content, currentUrl)` from `defuddle/full` (line 172).
3. If there's a selection, also converts it separately (line 164).
4. Each highlight's `.content` is also individually converted (line 181).
5. The result goes into `{{content}}` variable via `buildVariables()`.

**Step 3 — Template rendering** (`_reference/obsidian-clipper/src/utils/template-compiler.ts`, lines 42–82):

1. `compileTemplate()` calls `render(text, context)` which is the AST renderer.
2. The `{{content}}` variable already contains converted markdown.
3. The `|markdown` filter (`filters/markdown.ts:16-26`) can also be applied in templates, which calls `createMarkdownContent(str, baseUrl)` on demand.
4. Post-processing resolves deferred `{{selector:...}}` and `{{schema:...}}` variables.

**Key function: `createMarkdownContent` from `defuddle/full`**

- This is the library-level function that does the actual HTML-to-Markdown conversion.
- It is imported from the `defuddle` package (v0.16.0).
- The upstream does **not** use Turndown — it uses Defuddle's built-in markdown converter.

### 2B. Fork Pipeline: How Page Content Becomes Markdown

**Step 1 — Content extraction** (`apps/clipper-fork/src/content.ts`, lines 200–297):

1. Content script receives `"getPageContent"` message.
2. Runs `flattenShadowDom(document)` (same pattern).
3. Parses document, removes `<script>` and `<style>`, resolves relative URLs.
4. **Divergence**: Uses custom `findArticle(doc)` function (lines 89–113) with heuristic scoring instead of Defuddle's article detection.
5. Collects image URLs via `collectImageUrls(articleElement, document.URL)` (lines 165–196).
6. **Immediately converts to markdown** in the content script using `htmlToMarkdown(content, document.URL)` (line 244).
7. Applies `cleanMarkdownNoise()` post-processing (line 248).
8. Also runs Defuddle but **only for metadata** (title, author, etc.), **not** for content extraction.

**Step 2 — Template rendering** (`apps/clipper-fork/src/background.ts`, lines 223–404):

1. Background receives the already-converted markdown.
2. Builds variables with `buildVariables()` from `@authclip/template-engine`.
3. Renders template via `render(template, {...})` from `@authclip/template-engine`.
4. Collects all image URLs from both DOM discovery and compiled markdown (line 353).
5. Fetches assets as base64-encoded binary (lines 362–364).
6. Builds CapturePackage and sends via HTTP transport.

---

## 3. Key Difference: HTML-to-Markdown Engines

### 3A. Upstream: `defuddle/full` `createMarkdownContent`

**File**: `_reference/obsidian-clipper/src/utils/filters/markdown.ts` (lines 16–26) and `packages/template-engine/src/filters/markdown.ts` (lines 1–11).

```typescript
import { createMarkdownContent } from 'defuddle/full';

export const markdown = (str: string, param?: string): string => {
    const baseUrl = param || 'about:blank';
    try {
        return createMarkdownContent(str, baseUrl);
    } catch (error) {
        console.error('Error in createMarkdownContent:', error);
        return str;
    }
};
```

- This is a black-box library call — the conversion logic lives inside the `defuddle` package.
- Used both as a filter (`|markdown`) and directly in `content-extractor.ts` and `content.ts`.
- On error, returns the original string (HTML leaks through as fallback).

### 3B. Fork: Custom `htmlToMarkdown`

**File**: `apps/clipper-fork/src/html-to-markdown.ts` (321 lines, complete custom implementation).

This is a hand-written recursive DOM walker with explicit tag handling:

| Feature | Lines | Details |
|---------|-------|---------|
| **Skip tags** | 1–6 | `script`, `style`, `svg`, `path`, `defs`, `linearGradient`, `stop`, `button`, `input`, `textarea`, `select`, `form`, `noscript`, `iframe`, `app-cmf-icon`, `app-cmf-gravatar`, `app-cmf-obj-like-groups`, `app-cmf-doodle-icon`, `mat-menu` |
| **Inline vs block** | 8–17 | Hard-coded set of inline tags |
| **Image handling** | 85–92 | `![alt](resolvedUrl)` with URL resolution, **skips `data:` URIs** |
| **Figure handling** | 220–235 | Uses `<figcaption>` as alt text fallback |
| **Headings** | 104–109 | `#` through `######` |
| **Blockquotes** | 166–177 | `>` prefix |
| **Code blocks** | 158–163 | Detects `data-lang` attribute |
| **Lists** | 191–213 | Supports `ul`/`ol` with nesting |
| **Tables** | 273–302 | Markdown table format |
| **Links** | 179–188 | `[text](url)`, skips `#` and `javascript:` links |
| **Formatting** | 120–146 | Bold, italic, underline, strikethrough |
| **Mark/highlight** | 241–246 | `==text==` (Obsidian highlight) |
| **Fallback** | 253–260 | Any unrecognized block tag gets `\n\n` wrapper |

**Post-processing** (`apps/clipper-fork/src/content.ts`, lines 404–417):

```typescript
function cleanMarkdownNoise(md: string): string {
    return md
        .replace(/<(svg|path|defs|linearGradient|stop|g|rect|circle|line|polygon|polyline|text|tspan)[^>]*>[\s\S]*?<\/\1>/gi, "")
        .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, "")
        .replace(/<(app-|mat-)[a-z-]+[^>]*>[\s\S]*?<\/(app-|mat-)[a-z-]+>/gi, "")
        .replace(/<(svg|path|...)\b[^>]*\/>/gi, "")
        .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
        .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, "")
        .replace(/<span[^>]*>\s*<\/span>/gi, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&(amp|lt|gt|quot);/g, ...)
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
```

This is a regex-based cleanup that strips leftover SVG, button, Angular/Material component tags, empty spans, and HTML entities.

---

## 4. HTML Leakage Risk Analysis

### 4A. Upstream (Defuddle-based)

| Risk | Location | Details |
|------|----------|---------|
| **Error fallback** | `filters/markdown.ts:23` | If `createMarkdownContent` throws, raw HTML is returned as-is. |
| **Template `{{contentHtml}}`** | `shared.ts:72` | Raw HTML is exposed as `{{contentHtml}}` variable — if used directly in templates without `|markdown`, HTML leaks. |
| **No post-processing** | `content-extractor.ts` | No cleanup after `createMarkdownContent()` — relies entirely on Defuddle's output quality. |
| **Selector HTML** | `variables/selector.ts` | `selectorHtml:` variables return raw HTML — no markdown conversion. |
| **Highlight content** | `content-extractor.ts:181` | Each highlight's `.content` is converted individually, but may contain incomplete HTML fragments. |

### 4B. Fork (Custom converter)

| Risk | Location | Details |
|------|----------|---------|
| **Unrecognized tags** | `html-to-markdown.ts:253-259` | Any unrecognized block tag falls through to `convertChildren()` — the tag itself is dropped but its text content is preserved. Formatting semantics are lost. |
| **Inline HTML attributes** | `html-to-markdown.ts:248-251` | `<span>` passes through children only, but other inline elements not in `INLINE_TAGS` that aren't explicitly handled get the block treatment. |
| **SVG cleanup gaps** | `content.ts:406-411` | The `cleanMarkdownNoise` regex handles SVG, buttons, Angular/Material components, but could miss nested SVG-in-SVG or malformed tags. |
| **`<img>` in non-standard contexts** | `html-to-markdown.ts:85-92` | If `<img>` has no `src` or `src` is empty, it's silently dropped. |
| **HTML entity leakage** | `html-to-markdown.ts:72-74` | Tab/multi-space collapsing happens, but general entities beyond `&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;` are not decoded in the converter itself. `cleanMarkdownNoise` handles only a subset. |
| **`<figcaption>` handling** | `html-to-markdown.ts:237-239` | `figcaption` is completely skipped after extracting its text — if a figure has only a caption and no image, the caption is lost. |

---

## 5. Image Handling Comparison

### 5A. Upstream

1. **Defuddle extracts images**: `defuddle.image` provides the page's Open Graph / meta image.
2. **`createMarkdownContent`** handles `<img>` tags internally — the conversion is opaque (inside `defuddle/full`).
3. **`{{image}}` variable**: Contains just the URL of the page's main image (from `shared.ts:82`).
4. **`|image` filter** (`filters/image.ts`): Can convert a URL string or JSON array of URLs into `![alt](url)` markdown syntax.
5. **Images stay as remote URLs**: The upstream clipper sends notes to Obsidian via `obsidian://` URI protocol. Images remain as external URLs in the markdown. There is **no image downloading, no local attachment writing, no URL rewriting**.
6. **No asset discovery**: The upstream has no concept of discovering, downloading, or localizing images.

### 5B. Fork + Plugin (End-to-End)

1. **Asset discovery in content script** (`content.ts:165-196`):
   - `collectImageUrls()`: Scans article DOM for `<img src>`, `<img srcset>`, `<picture source srcset>` — resolves all to absolute URLs.
   - Returns `imageUrls: string[]` alongside the markdown.

2. **Image URLs in markdown** (`html-to-markdown.ts:85-92`):
   - `<img>` tags are converted to `![alt](resolvedUrl)` with URL resolution via `resolveUrl()`.
   - `data:` URIs are explicitly skipped (line 88).
   - `<figure>` + `<figcaption>` produces `![caption](url)` (lines 220–235).

3. **Post-template image URL extraction** (`background.ts:406-427`):
   - `extractImageUrls()` parses compiled markdown for both `![...](url)` and `<img src="...">` patterns.
   - Merges DOM-discovered URLs with markdown-extracted URLs (line 353).

4. **Asset fetching** (`asset-discovery-wrapper.ts` / `asset-fetcher.ts`):
   - Downloads images with `fetch({ credentials: "include" })` — authenticated access.
   - Converts to base64 `AttachmentPayload` with MIME detection.
   - Concurrent download (4 workers), timeout (30s), size limits (25MB).

5. **LinkMap generation** (`package-builder.ts:41-46`):
   - Maps each `originalUrl` to an `attachmentId`.

6. **Attachment writing** (`obsidian-plugin/src/attachment-writer.ts`):
   - Decodes base64, writes binary to vault path.

7. **Markdown URL rewriting** (`obsidian-plugin/src/markdown-rewriter.ts:38-95`):
   - **Two patterns matched**: `IMAGE_MD_PATTERN` (`![alt](url)`) and `IMAGE_HTML_PATTERN` (`<img src="...">`).
   - **Wikilink mode** (default): `![[filename.ext]]`.
   - **Relative path mode**: `![alt](./relative/path)`.
   - Failed attachments get `<!-- authclip: failed to localize URL -->` comment appended.
   - HTML `<img>` tags with failed attachments are silently removed (line 87).

---

## 6. Template/Schema System Comparison

### 6A. Upstream Template System

- **Full template engine**: Tokenizer → Parser (AST) → Renderer with filters, conditionals, loops, variable assignment.
- **50+ filters**: `markdown`, `image`, `link`, `wikilink`, `strip_tags`, `remove_html`, `strip_md`, `replace`, `split`, `date`, etc.
- **Schema.org support**: `{{schema:@Movie.genre}}` with nested array access.
- **Selector variables**: `{{selector:div.class}}` and `{{selectorHtml:div.class}}` for CSS-selector-based extraction.
- **Prompt variables**: `{{"summarize this page"}}` for LLM-powered interpretation.
- **Output via Obsidian URI**: `obsidian://new?file=...&content=...`.

### 6B. Fork Template System

- **Uses `@authclip/template-engine` package** (extracted from upstream, in `packages/template-engine/`).
- **Same engine**: Same tokenizer, parser, renderer, filters.
- **Simpler default template** (`background.ts:6-18`): Just title, source URL, author, date, content.
- **Custom async resolver** for selectors (`background.ts:318-343`): Resolves `selector:` and `selectorHtml:` by sending messages to content script.
- **Output via HTTP**: Sends CapturePackage to local plugin, which writes note + attachments to vault.

---

## 7. Summary of Critical Differences

| Aspect | Upstream (v1.4.0) | Fork (v0.2.0) |
|--------|-------------------|----------------|
| **HTML-to-MD engine** | `defuddle/full` `createMarkdownContent` (library) | Custom hand-written DOM walker (`html-to-markdown.ts`, 321 lines) |
| **Where conversion happens** | In `content-extractor.ts` (background/popup context) | In content script (`content.ts`) before sending to background |
| **Article detection** | Defuddle's built-in parser | Custom `findArticle()` with heuristic scoring (text density, content hints, tag scoring) |
| **Image localization** | None — images stay as remote URLs | Full pipeline: discover → fetch → base64 → write → rewrite URLs to local |
| **Authentication** | No credential forwarding | `credentials: "include"` on fetch, auth token on HTTP transport |
| **Post-processing** | None after `createMarkdownContent` | `cleanMarkdownNoise()` regex cleanup for SVG, buttons, Angular components |
| **HTML entity handling** | Defuddle handles internally | Partial: `&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;` in cleanup |
| **SVG handling** | Defuddle handles internally | Explicit skip tags + regex cleanup (dual defense) |
| **Data URI images** | Defuddle decides | Explicitly skipped (`!src.startsWith("data:")`) |
| **Figure/figcaption** | Defuddle handles internally | `figcaption` used as alt text, standalone figcaptions dropped |
| **Note delivery** | `obsidian://` URI protocol | HTTP POST to local plugin → direct vault write |
| **Template engine** | Embedded in extension | Extracted to `packages/template-engine/` workspace package |
| **HTML `<img>` in output** | Possible if Defuddle doesn't convert | Handled by `IMAGE_HTML_PATTERN` in `markdown-rewriter` (plugin side) |
