# AuthClip for Obsidian

Browser extension + Obsidian plugin for clipping web pages with **local image saving**. Unlike the standard Obsidian Web Clipper, AuthClip downloads images in the browser's authenticated session context and stores them as local vault files — so clipped notes work offline and behind login walls.

## Architecture

AuthClip consists of three packages in a pnpm monorepo:

```
authclip/
├── packages/shared-types/     # Shared types, Zod schemas, utilities
├── apps/clipper-fork/         # Browser extension (Chrome/Edge)
└── apps/obsidian-plugin/      # Obsidian desktop plugin
```

### How it works

1. **Browser extension** discovers images on the current page (`<img src>`, `srcset`, `<picture>`), downloads them using the browser's session cookies, and sends a `CapturePackage` (markdown + base64-encoded attachments) to the Obsidian plugin via HTTP.
2. **Obsidian plugin** receives the package over `localhost`, writes attachment files to the vault, rewrites markdown image URLs to local links (`![[image.jpg]]` or `![](./path)`), and creates the note.

### Data flow

```
[Web page] → [Extension popup] → [Background service worker]
                                         ↓ fetch assets with cookies
                                         ↓ build CapturePackage
                                         ↓ POST http://127.0.0.1:27124/v1/capture
                                  [Obsidian plugin HTTP server]
                                         ↓ validate package
                                         ↓ write attachments to vault
                                         ↓ rewrite markdown to local links
                                         ↓ create note
                                  [Obsidian vault]
```

## Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0
- **Obsidian** ≥ 1.5.0 (desktop)
- **Chrome** or **Edge** (Chromium-based browser)

## Build

### Install dependencies

```bash
pnpm install
```

### Build everything

```bash
pnpm run build:all
```

This runs:
1. `pnpm run build` — compiles shared-types, clipper-fork library, and bundles the Obsidian plugin
2. `pnpm run build:extension` — bundles the browser extension

### Build individual components

```bash
# Shared types library only
pnpm --filter @authclip/shared-types run build

# Obsidian plugin only (produces dist/main.js + manifest.json + styles.css)
pnpm run build:plugin

# Browser extension only (produces dist-extension/)
pnpm run build:extension
```

### Run tests

```bash
pnpm run test
```

### Type checking

```bash
pnpm run typecheck
```

## Installation

> **Важно:** плагины не распространяются как готовые файлы — они генерируются локально из исходного кода. Сначала нужно клонировать репозиторий и собрать проект (см. раздел [Build](#build) выше). После сборки артефакты появятся в папках `apps/obsidian-plugin/dist/` и `apps/clipper-fork/dist-extension/`.

Проверить что сборка прошла успешно:

```bash
ls -la apps/obsidian-plugin/dist/main.js apps/obsidian-plugin/dist/manifest.json apps/obsidian-plugin/dist/styles.css apps/clipper-fork/dist-extension/manifest.json apps/clipper-fork/dist-extension/background.js apps/clipper-fork/dist-extension/popup.html
```

Ожидаемый вывод — 6 файлов с ненулевым размером:
```
apps/obsidian-plugin/dist/main.js
apps/obsidian-plugin/dist/manifest.json
apps/obsidian-plugin/dist/styles.css
apps/clipper-fork/dist-extension/manifest.json
apps/clipper-fork/dist-extension/background.js
apps/clipper-fork/dist-extension/popup.html
```

### 1. Установка плагина в Obsidian

Готовые файлы лежат в `apps/obsidian-plugin/dist/`. Нужно скопировать 3 файла в папку vault:

```powershell
# Замените путь на ваш vault
$pluginDir = "C:\Users\tux\Documents\MyVault\.obsidian\plugins\authclip"
New-Item -ItemType Directory -Force -Path $pluginDir
Copy-Item apps\obsidian-plugin\dist\main.js $pluginDir\
Copy-Item apps\obsidian-plugin\dist\manifest.json $pluginDir\
Copy-Item apps\obsidian-plugin\dist\styles.css $pluginDir\
```

Или для Linux/macOS:

```bash
PLUGIN_DIR="/path/to/vault/.obsidian/plugins/authclip"
mkdir -p "$PLUGIN_DIR"
cp apps/obsidian-plugin/dist/main.js apps/obsidian-plugin/dist/manifest.json apps/obsidian-plugin/dist/styles.css "$PLUGIN_DIR/"
```

Затем в Obsidian:
1. Откройте **Settings → Community plugins**
2. Нажмите **Reload**, если плагин не появился
3. Найдите **AuthClip** в списке и включите тумблер

После включения плагин запустит HTTP-сервер на `127.0.0.1:27124`. Настройки плагина — в **Settings → AuthClip**:
- **HTTP Port** — порт для связи с расширением (по умолчанию 27124)
- **Auth Token** — опциональный общий секрет; оставьте пустым для отключения авторизации
- Остальные настройки: папка заметок, стратегия вложений, режим ссылок и т.д.

### 2. Установка расширения в Chrome/Edge

Готовая папка расширения: `apps/clipper-fork/dist-extension/`

#### Chrome

1. Откройте `chrome://extensions/`
2. Включите **Developer mode** (переключатель справа вверху)
3. Нажмите **Load unpacked**
4. Выберите папку `apps/clipper-fork/dist-extension/`

#### Edge

1. Откройте `edge://extensions/`
2. Включите **Developer mode** (переключатель на левой панели)
3. Нажмите **Load unpacked**
4. Выберите ту же папку `dist-extension/`

### 3. Использование

1. Откройте любую веб-страницу (желательно залогиненную, если сайт требует авторизацию)
2. Нажмите иконку **AuthClip** в панели браузера
3. Убедитесь что статус **"Connected to Obsidian AuthClip plugin"** — если нет, проверьте что Obsidian открыт и плагин включён
4. Нажмите **"Clip with Assets"**
5. Дождитесь завершения — расширение скачает картинки с cookies вашей сессии и отправит их в Obsidian
6. Зайдите в Obsidian — заметка с картинками появится в папке `Clippings/`

### Что сохраняется

- **Markdown-заметка** с frontmatter (URL источника, заголовок, дата, количество ассетов)
- **Файлы изображений** из контента страницы, скачанные с cookies браузерной сессии
- Ссылки на изображения в markdown переписаны на локальные (`![[image.jpg]]` или `![](./path)`)

### Plugin settings

| Setting | Default | Description |
|---------|---------|-------------|
| HTTP Port | 27124 | Port for localhost communication |
| Auth Token | (empty) | Shared secret; leave empty to disable auth |
| Default Note Folder | Clippings | Folder for new clipped notes |
| Attachment Folder Strategy | Subfolder | `same-as-note`, `subfolder`, or `global` |
| Attachment Subfolder Name | _assets | Subfolder name when strategy is `subfolder` |
| Global Attachment Folder | attachments | Folder path when strategy is `global` |
| Rewrite Mode | Wikilink | `wikilink` (`![[file]]`) or `relative-markdown` (`![](path)`) |
| Keep Source URL in Frontmatter | Yes | Store original page URL in note frontmatter |

## Project Structure

```
packages/shared-types/
├── src/
│   ├── attachment.ts         # DiscoveredAsset, AttachmentPayload, AttachmentStatus
│   ├── capture-package.ts    # CapturePackage, CaptureSource, CaptureOptions
│   ├── errors.ts             # ClipErrorCode union type
│   ├── link-map.ts           # LinkMapEntry
│   ├── result-report.ts      # ResultReport, buildResultStatus()
│   ├── sanitize.ts           # sanitizeFilename(), generateSafeName(), extractFilenameFromUrl()
│   ├── schemas.ts            # Zod validation schemas for all types
│   └── settings.ts           # ClipSettings, DEFAULT_SETTINGS
└── __tests__/                # 87 tests

apps/clipper-fork/
├── src/
│   ├── asset-discovery.ts           # DOM-based asset discovery (img, srcset, picture)
│   ├── asset-fetcher.ts             # Concurrent asset fetching with session cookies
│   ├── asset-discovery-wrapper.ts   # Fetch logic for extension service worker context
│   ├── package-builder.ts           # Assembles CapturePackage
│   ├── background.ts                # Extension background service worker
│   ├── popup.ts                     # Extension popup UI logic
│   ├── transport.ts                 # HTTP client for Obsidian plugin communication
│   └── index.ts                     # Library exports
├── popup.html                       # Extension popup HTML
├── extension-manifest.json          # Chrome Extension Manifest V3
├── esbuild.config.mjs               # Extension build config
└── __tests__/                       # 43 tests

apps/obsidian-plugin/
├── src/
│   ├── main.ts                      # Plugin entry point (AuthClipPlugin)
│   ├── http-server.ts               # Localhost HTTP server (/v1/health, /v1/capture)
│   ├── manifest-validator.ts        # CapturePackage validation with Zod
│   ├── clip-transaction.ts          # Orchestrator: write attachments, rewrite, save note
│   ├── attachment-writer.ts         # Base64 decode + vault binary write
│   ├── markdown-rewriter.ts         # URL → wikilink/relative path rewriting
│   ├── path-resolver.ts             # Note/attachment path resolution strategies
│   ├── vault-adapter.ts             # VaultAdapter interface
│   ├── obsidian-vault-adapter.ts    # Real implementation using Obsidian API
│   ├── settings.ts                  # Settings loader
│   ├── settings-tab.ts              # Settings UI in Obsidian
│   └── index.ts                     # Library exports
├── manifest.json                    # Obsidian plugin manifest
├── styles.css                       # Settings styles
├── esbuild.config.mjs               # Plugin build config (bundles to single main.js)
└── __tests__/                       # 89 tests
```

## Transport Protocol

The extension communicates with the plugin over HTTP on `127.0.0.1`.

### Health check

```
GET /v1/health → { "status": "ok" }
```

### Capture

```
POST /v1/capture
Content-Type: application/json
X-AuthClip-Token: <token> (optional)

{
  "version": "1.0",
  "source": { "url": "...", "title": "...", "capturedAt": "..." },
  "note": { "pathHint": "Clippings/2026-04-14 Title.md", "markdown": "..." },
  "attachments": [
    {
      "id": "asset_1",
      "originalUrl": "https://example.com/image.jpg",
      "mimeType": "image/jpeg",
      "suggestedName": "image.jpg",
      "dataBase64": "..."
    }
  ],
  "linkMap": [
    { "from": "https://example.com/image.jpg", "attachmentId": "asset_1" }
  ],
  "options": { "rewriteMode": "wikilink", "deduplicate": true }
}

→ ResultReport
```

## Error Handling

AuthClip follows a **graceful degradation** model:

- If some images fail to download, the note is still saved with the successful ones
- Failed image URLs are kept as-is with an HTML comment marker
- The result report shows saved/failed/skipped counts
- Status: `success` (all saved), `partial` (some failed), `failed` (note could not be saved)

## Tech Stack

- **TypeScript** throughout
- **Zod** for runtime validation
- **esbuild** for bundling
- **pnpm** workspaces for monorepo management
- **vitest** for testing (219 tests)
- **Obsidian API** for plugin integration
- **Chrome Extension Manifest V3** for browser extension

## License

MIT
