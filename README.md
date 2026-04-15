# AuthClip

Browser extension + Obsidian plugin for clipping web pages with **local image saving**. Unlike the standard Obsidian Web Clipper, AuthClip downloads images using the browser's authenticated session and stores them as local vault files — clipped notes work offline and behind login walls.

## How It Works

```
[Web page] → [Extension popup] → [Background service worker]
                                        ↓ fetch assets with cookies
                                        ↓ build CapturePackage
                                        ↓ POST http://127.0.0.1:27124/v1/capture
                                 [Obsidian plugin HTTP server]
                                        ↓ validate package
                                        ↓ write attachments to vault
                                        ↓ rewrite markdown to local links
                                        ↓ create note with frontmatter
                                 [Obsidian vault]
```

1. **Browser extension** discovers images on the page (`<img src>`, `srcset`, `<picture>`), downloads them with session cookies, and sends a `CapturePackage` to the plugin via HTTP.
2. **Obsidian plugin** receives the package, validates the manifest, writes attachment files to the vault, rewrites image URLs to local links, and creates a note with YAML frontmatter.

## Architecture

pnpm monorepo with 4 packages:

```
authclip/
├── packages/shared-types/      # Types, Zod schemas, sanitization (Layer 0)
├── packages/template-engine/   # Tokenizer, parser, renderer, 50+ filters (Layer 1)
├── apps/clipper-fork/          # Chrome/Edge browser extension (Layer 2)
└── apps/obsidian-plugin/       # Obsidian desktop plugin (Layer 2)
```

### Module Overview

| Module | Role | Key Exports | Status |
|---|---|---|---|
| **shared-types** | Shared protocol | CapturePackage, AttachmentPayload, ResultReport, ClipSettings, Zod schemas, sanitizeFilename | Implemented |
| **template-engine** | Note rendering | renderTemplate, tokenize, parse, 50+ filters, variable resolvers | Implemented |
| **clipper-fork** | Browser capture | discoverAssets, fetchAssets, buildCapturePackage, sendCapturePackage, checkHealth | Implemented |
| **obsidian-plugin** | Vault writer | startHttpServer, validateCapturePackage, executeClipTransaction, writeAttachment, rewriteMarkdown | Implemented |

### Implementation Status

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Shared Protocol & Types | Done |
| Phase 2 | Browser Capture MVP | Done |
| Phase 3 | Obsidian Plugin MVP | Done |
| Phase 4 | Integration & Polish (hash dedup, CSS bg, security audit) | Pending |

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Obsidian** >= 1.5.0 (desktop)
- **Chrome** or **Edge** (Chromium-based)

## Build

```bash
pnpm install

# Build everything
pnpm run build:all

# Or individually
pnpm --filter @authclip/shared-types run build       # shared types
pnpm run build:plugin                                  # Obsidian plugin → dist/
pnpm run build:extension                               # Chrome extension → dist-extension/
```

### Run tests

```bash
pnpm run test                # all packages
pnpm run typecheck           # TypeScript checks
```

## Installation

### Obsidian Plugin

Copy build artifacts to your vault:

```bash
PLUGIN_DIR="/path/to/vault/.obsidian/plugins/authclip"
mkdir -p "$PLUGIN_DIR"
cp apps/obsidian-plugin/dist/main.js \
   apps/obsidian-plugin/dist/manifest.json \
   apps/obsidian-plugin/dist/styles.css \
   "$PLUGIN_DIR/"
```

Then in Obsidian: **Settings → Community plugins → enable AuthClip**.

The plugin starts an HTTP server on `127.0.0.1:27124`. Configure in **Settings → AuthClip**.

### Chrome Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `apps/clipper-fork/dist-extension/`

### Usage

1. Navigate to any web page (logged in if the site requires auth)
2. Click the **AuthClip** icon in the browser toolbar
3. Verify status shows **"Connected to Obsidian AuthClip plugin"**
4. Click **"Clip with Assets"**
5. Check Obsidian — the note appears in `Clippings/` with local images

## Plugin Settings

| Setting | Default | Description |
|---|---|---|
| HTTP Port | 27124 | Localhost communication port |
| Auth Token | *(empty)* | Shared secret; leave empty to disable |
| Default Note Folder | Clippings | Folder for new clipped notes |
| Attachment Folder Strategy | Subfolder | `same-as-note`, `subfolder`, or `global` |
| Attachment Subfolder Name | _assets | Subfolder name when strategy is `subfolder` |
| Global Attachment Folder | attachments | Path when strategy is `global` |
| Rewrite Mode | Wikilink | `wikilink` (`![[file]]`) or `relative-markdown` (`![](path)`) |
| Keep Source URL in Frontmatter | Yes | Store original page URL |

## Transport Protocol

### Health check

```
GET /v1/health → { "status": "ok" }
```

### Capture

```
POST /v1/capture
Content-Type: application/json
X-AuthClip-Token: <token>  (optional)

{
  "version": "1.0",
  "source": { "url": "...", "title": "...", "capturedAt": "..." },
  "note":   { "pathHint": "Clippings/2026-04-14 Title.md", "markdown": "..." },
  "attachments": [
    { "id": "asset_1", "originalUrl": "...", "mimeType": "image/jpeg",
      "suggestedName": "image.jpg", "dataBase64": "..." }
  ],
  "linkMap": [
    { "from": "https://example.com/image.jpg", "attachmentId": "asset_1" }
  ],
  "options": { "rewriteMode": "wikilink", "deduplicate": true }
}

→ ResultReport
```

## What Gets Saved

- **Markdown note** with YAML frontmatter (source_url, title, date, author, domain, word_count, assets_saved, assets_failed)
- **Image files** downloaded with browser session cookies
- **Local links** — markdown image URLs rewritten to `![[image.jpg]]` or `![](./path)`

## Error Handling

- Some images fail → note still saves with successful ones
- Failed URLs kept as-is with HTML comment marker
- Result report shows saved/failed/skipped counts
- Status: `success` | `partial` | `failed`

## Tech Stack

| Tech | Version | Purpose |
|---|---|---|
| TypeScript | 5.6+ | Language |
| Zod | ^3.23.0 | Runtime validation |
| esbuild | ^0.28.0 | Plugin bundling |
| webpack | ^5.106.1 | Extension bundling |
| vitest | ^3.0.0 | Testing |
| pnpm workspaces | 9.x | Monorepo management |
| Chrome Extension MV3 | — | Browser extension |
| Obsidian Plugin API | latest | Plugin integration |

## Releases

Pre-built artifacts are available on the [Releases page](https://github.com/kucheryavenkovn/authclip/releases). Each release includes:

- `authclip-chrome-extension.zip` — load unpacked in Chrome/Edge
- `authclip-obsidian-plugin.zip` — copy to `.obsidian/plugins/authclip/`

Releases are built automatically on every push to `master` via GitHub Actions.

## License

MIT
