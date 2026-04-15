# AuthClip

Браузерное расширение + плагин для Obsidian для клипирования веб-страниц с **локальным сохранением изображений**. В отличие от стандартного Obsidian Web Clipper, AuthClip скачивает картинки в контексте авторизованной сессии браузера и сохраняет их как локальные файлы — заметки работают офлайн и за экранами логина.

## Как это работает

```
[Веб-страница] → [Popup расширения] → [Background service worker]
                                            ↓ скачивает ассеты с cookies
                                            ↓ собирает CapturePackage
                                            ↓ POST http://127.0.0.1:27124/v1/capture
                                     [HTTP-сервер плагина Obsidian]
                                            ↓ валидирует пакет
                                            ↓ записывает вложения в vault
                                            ↓ переписывает ссылки на локальные
                                            ↓ создаёт заметку с frontmatter
                                     [Obsidian vault]
```

1. **Расширение** находит изображения на странице (`<img src>`, `srcset`, `<picture>`), скачивает их с cookies сессии браузера и отправляет `CapturePackage` плагину по HTTP.
2. **Плагин Obsidian** принимает пакет, валидирует манифест, записывает файлы вложений, переписывает URL картинок на локальные ссылки и создаёт заметку с YAML frontmatter.

## Архитектура

Монорепозиторий pnpm из 4 пакетов:

```
authclip/
├── packages/shared-types/      # Типы, Zod-схемы, санитизация (Слой 0)
├── packages/template-engine/   # Токенизатор, парсер, рендерер, 50+ фильтров (Слой 1)
├── apps/clipper-fork/          # Расширение Chrome/Edge (Слой 2)
└── apps/obsidian-plugin/       # Плагин для Obsidian Desktop (Слой 2)
```

### Модули

| Модуль | Роль | Ключевые экспорты | Статус |
|---|---|---|---|
| **shared-types** | Общий протокол | CapturePackage, AttachmentPayload, ResultReport, ClipSettings, Zod-схемы, sanitizeFilename | Реализован |
| **template-engine** | Рендеринг заметок | renderTemplate, tokenize, parse, 50+ фильтров, резолверы переменных | Реализован |
| **clipper-fork** | Захват из браузера | discoverAssets, fetchAssets, buildCapturePackage, sendCapturePackage, checkHealth | Реализован |
| **obsidian-plugin** | Запись в vault | startHttpServer, validateCapturePackage, executeClipTransaction, writeAttachment, rewriteMarkdown | Реализован |

### Статус реализации

| Фаза | Описание | Статус |
|---|---|---|
| Фаза 1 | Общий протокол и типы | Готово |
| Фаза 2 | Browser Capture MVP | Готово |
| Фаза 3 | Obsidian Plugin MVP | Готово |
| Фаза 4 | Интеграция: hash-дедуп, CSS background, аудит безопасности | Ожидает |

## Требования

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Obsidian** >= 1.5.0 (desktop)
- **Chrome** или **Edge** (на Chromium)

## Сборка

```bash
pnpm install

# Собрать всё
pnpm run build:all

# Или по отдельности
pnpm --filter @authclip/shared-types run build       # общие типы
pnpm run build:plugin                                  # плагин Obsidian → dist/
pnpm run build:extension                               # расширение Chrome → dist-extension/
```

### Тесты

```bash
pnpm run test                # все пакеты
pnpm run typecheck           # проверки TypeScript
```

## Установка

### Плагин Obsidian

Скопируйте артефакты сборки в ваш vault:

```powershell
# Windows PowerShell
$pluginDir = "C:\Users\...\MyVault\.obsidian\plugins\authclip"
New-Item -ItemType Directory -Force -Path $pluginDir
Copy-Item apps\obsidian-plugin\dist\main.js $pluginDir\
Copy-Item apps\obsidian-plugin\dist\manifest.json $pluginDir\
Copy-Item apps\obsidian-plugin\dist\styles.css $pluginDir\
```

```bash
# Linux/macOS
PLUGIN_DIR="/path/to/vault/.obsidian/plugins/authclip"
mkdir -p "$PLUGIN_DIR"
cp apps/obsidian-plugin/dist/{main.js,manifest.json,styles.css} "$PLUGIN_DIR/"
```

Затем в Obsidian: **Settings → Community plugins → включить AuthClip**.

Плагин запускает HTTP-сервер на `127.0.0.1:27124`. Настройки: **Settings → AuthClip**.

### Расширение Chrome

1. Откройте `chrome://extensions/`
2. Включите **Developer mode** (переключатель справа вверху)
3. Нажмите **Load unpacked**
4. Выберите папку `apps/clipper-fork/dist-extension/`

### Использование

1. Откройте любую веб-страницу (желательно залогиненную)
2. Нажмите иконку **AuthClip** в панели браузера
3. Убедитесь что статус **"Connected to Obsidian AuthClip plugin"**
4. Нажмите **"Clip with Assets"**
5. Проверьте Obsidian — заметка появится в папке `Clippings/` с локальными картинками

## Настройки плагина

| Настройка | По умолчанию | Описание |
|---|---|---|
| HTTP Port | 27124 | Порт для localhost-связи |
| Auth Token | *(пусто)* | Общий секрет; пустое = без авторизации |
| Default Note Folder | Clippings | Папка для новых заметок |
| Attachment Folder Strategy | Subfolder | `same-as-note`, `subfolder` или `global` |
| Attachment Subfolder Name | _assets | Имя подпапки при стратегии `subfolder` |
| Global Attachment Folder | attachments | Путь при стратегии `global` |
| Rewrite Mode | Wikilink | `wikilink` (`![[файл]]`) или `relative-markdown` (`![](путь)`) |
| Keep Source URL in Frontmatter | Yes | Сохранять оригинальный URL страницы |

## Транспортный протокол

### Проверка здоровья

```
GET /v1/health → { "status": "ok" }
```

### Захват

```
POST /v1/capture
Content-Type: application/json
X-AuthClip-Token: <token>  (опционально)

{
  "version": "1.0",
  "source": { "url": "...", "title": "...", "capturedAt": "..." },
  "note":   { "pathHint": "Clippings/2026-04-14 Заголовок.md", "markdown": "..." },
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

## Что сохраняется

- **Markdown-заметка** с YAML frontmatter (source_url, title, date, author, domain, word_count, assets_saved, assets_failed)
- **Файлы изображений**, скачанные с cookies браузерной сессии
- **Локальные ссылки** — URL картинок переписаны на `![[image.jpg]]` или `![](./path)`

## Обработка ошибок

- Часть картинок не скачалась → заметка всё равно сохраняется с успешными
- Неудачные URL остаются с HTML-комментарием-маркером
- Отчёт показывает saved/failed/skipped
- Статус: `success` | `partial` | `failed`

## Стек

| Технология | Версия | Назначение |
|---|---|---|
| TypeScript | 5.6+ | Язык |
| Zod | ^3.23.0 | Runtime-валидация |
| esbuild | ^0.28.0 | Бандлинг плагина |
| webpack | ^5.106.1 | Бандлинг расширения |
| vitest | ^3.0.0 | Тестирование |
| pnpm workspaces | 9.x | Управление монорепо |
| Chrome Extension MV3 | — | Браузерное расширение |
| Obsidian Plugin API | latest | Интеграция с плагином |

## Релизы

Готовые артефакты доступны на [странице релизов](https://github.com/kucheryavenkovn/authclip/releases). Каждый релиз включает:

- `authclip-chrome-extension.zip` — загрузить как распакованное расширение в Chrome/Edge
- `authclip-obsidian-plugin.zip` — скопировать в `.obsidian/plugins/authclip/`

Релизы собираются автоматически при каждом push в `master` через GitHub Actions.

## Лицензия

MIT
