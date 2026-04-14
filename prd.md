# PRD: Auth-Aware Obsidian Web Clipper Fork + Companion Plugin

## 1. Название продукта

**AuthClip for Obsidian**

Форк браузерного Obsidian Web Clipper + companion plugin для Obsidian, который сохраняет изображения и вложения из страниц с авторизацией как локальные файлы vault, а не как внешние ссылки.

---

## 2. Контекст и проблема

Пользователь сохраняет контент из сайтов, где изображения и часть ресурсов доступны только в рамках активной браузерной сессии. Стандартное поведение Web Clipper сохраняет в заметку внешние URL на изображения. После этого Obsidian открывает заметку уже вне исходной браузерной сессии, и закрытые изображения перестают отображаться.

### Проблемы текущего подхода
- заметка сохраняется неполноценно;
- offline-режим фактически не работает;
- знания из закрытых источников не становятся долговечными внутри vault;
- заметка теряет ценность как архивный артефакт;
- пользователь вынужден вручную скачивать изображения и перепривязывать их к заметке.

---

## 3. Видение решения

Нужно реализовать связку из двух компонентов:

### 3.1. Fork browser clipper
Компонент работает в браузере на открытой, уже авторизованной странице:
- извлекает markdown-контент;
- ищет бинарные ресурсы страницы;
- скачивает ресурсы в контексте текущей браузерной сессии;
- формирует manifest вложений;
- отправляет в Obsidian заметку + вложения единым логическим пакетом.

### 3.2. Obsidian companion plugin
Компонент работает внутри Obsidian:
- принимает пакет от форка клиппера;
- создает note;
- сохраняет вложения в папку vault;
- переписывает markdown-ссылки на локальные `![[...]]` или относительные пути;
- валидирует целостность сохранения;
- возвращает статус обратно в extension.

---

## 4. Цель продукта

Обеспечить надежное сохранение web-контента из авторизованных источников в Obsidian в виде:
- локальной markdown-заметки;
- локальных изображений/вложений;
- автономного результата, не зависящего от истечения web-сессии.

---

## 5. Цели релиза v1

### 5.1. Обязательно
- сохранять изображения из `<img src>`, `srcset`, `picture source[srcset]`;
- поддержать CSS `background-image` для контента статьи;
- скачивать ресурсы в браузере с учетом cookies текущей сессии;
- передавать бинарные данные в Obsidian;
- сохранять локальные файлы в vault;
- переписывать markdown на локальные ссылки;
- поддерживать частичный успех при сбоях;
- поддерживать Chrome/Edge;
- поддерживать Windows/macOS/Linux на стороне Obsidian Desktop.

### 5.2. Желательно
- дедупликация вложений по hash;
- настраиваемая папка вложений;
- безопасные имена файлов;
- повторная попытка при частичных сбоях;
- UI предпросмотра списка вложений перед сохранением.

### 5.3. Не входит в v1
- видео и потоковые медиа;
- полное сохранение сайта/crawl;
- OCR;
- PDF rendering;
- автоматический re-login;
- обход DRM, CAPTCHA и антибот-защит;
- синхронизация изменений источника после клиппинга;
- мобильная версия.

---

## 6. Пользовательские роли

### 6.1. Knowledge worker
Хочет сохранить статью или документацию из закрытого сайта так, чтобы она открывалась в Obsidian без повторной авторизации.

### 6.2. Researcher / Analyst
Хочет архивировать знания из внутренних порталов, helpdesk, LMS, Confluence-подобных систем, личных кабинетов и платных медиа.

### 6.3. Power user
Хочет контролировать шаблон note naming, папки, формат ссылок, политику дедупликации и поведение при ошибках.

---

## 7. Основные user stories

### US-01
Как пользователь, я хочу клиппировать авторизованную страницу и получить заметку с локальными картинками, чтобы она открывалась позже без доступа к сайту.

### US-02
Как пользователь, я хочу видеть, какие ресурсы будут скачаны, чтобы исключить мусорные изображения.

### US-03
Как пользователь, я хочу, чтобы при ошибке скачивания части картинок заметка все равно сохранилась, а проблемные ресурсы были перечислены в отчете.

### US-04
Как пользователь, я хочу настраивать путь сохранения вложений, чтобы соблюдать структуру vault.

### US-05
Как пользователь, я хочу, чтобы одинаковые картинки не дублировались, если уже были сохранены ранее.

### US-06
Как пользователь, я хочу иметь fallback-режим, при котором note сохраняется даже без части вложений, чтобы не терять собранный контент.

---

## 8. Бизнес-ценность

- повышает полезность Web Clipper для закрытых источников;
- превращает клиппинг в архивирование, а не в сохранение битых ссылок;
- уменьшает ручную работу по скачиванию картинок;
- позволяет строить устойчивую knowledge base из приватных источников;
- увеличивает ценность Obsidian как personal knowledge archive для закрытого контента.

---

## 9. Принципы продукта

- **Session-aware**: скачивание происходит там, где авторизация уже есть — в браузере.
- **Local-first**: результат в vault должен жить независимо от сайта.
- **Graceful degradation**: частичный успех лучше, чем полный отказ.
- **Transparent**: пользователь видит, что скачалось, что нет и почему.
- **Safe by default**: не логировать cookies, auth headers, токены, query params с секретами.

---

## 10. Scope

### In scope
- browser extension fork;
- Obsidian plugin;
- локальное сохранение изображений и файлов;
- markdown rewrite;
- manifest protocol;
- статус-ответ от plugin к extension;
- настройки путей, имен, дедупликации;
- базовая локальная диагностика без чувствительных данных.

### Out of scope
- cloud backend;
- серверное хранение;
- account system;
- collaborative clipping;
- mobile support на первом этапе;
- автоматическая обработка вообще любых JS-heavy ресурсов, если они недоступны из браузерного контекста.

---

## 11. Product assumptions

1. Пользователь уже авторизован на сайте в текущем браузере.
2. Браузер может запросить большую часть нужных ресурсов через `fetch`, DOM access или extension APIs в контексте страницы.
3. Obsidian plugin имеет право писать файлы в vault.
4. Передача бинарных данных между extension и plugin допустима по объему для типовых статей.
5. Разработка будет вестись в **Kilo Code** с использованием **z.ai GLM 5.1** как основной модели для архитектурных задач, рефакторингов и multi-file изменений.

---

## 12. Ограничения и зависимости

### 12.1. Технические ограничения
- CORS, CSP, `blob:`, `data:`, lazy-loaded assets;
- часть ресурсов может быть недоступна из extension context;
- некоторые сайты рендерят картинки только после scroll/intersection;
- очень большие страницы могут давать большие payload.

### 12.2. Продуктовые ограничения
- нельзя обещать сохранение 100% ресурсов для любого сайта;
- решение не должно выглядеть как средство обхода защиты;
- надо сохранить совместимость с логикой шаблонов Web Clipper.

### 12.3. Внешние зависимости
- Obsidian desktop plugin API;
- кодовая база форка Web Clipper;
- локальная файловая система vault;
- browser extension APIs;
- базовые возможности Kilo Code для работы с monorepo и агентной генерации кода.

---

## 13. Архитектура решения

## 13.1. Компоненты

### A. Browser extension fork
Модули:
- content extractor;
- asset discovery;
- asset fetcher;
- manifest builder;
- transport client;
- preview UI;
- error reporter.

### B. Obsidian plugin
Модули:
- receiver endpoint / command bridge;
- manifest validator;
- attachment writer;
- markdown rewriter;
- dedup engine;
- transaction/status manager;
- settings UI.

## 13.2. Поток данных

1. Пользователь открывает авторизованную страницу.
2. Нажимает `Clip with local assets`.
3. Extension:
   - выделяет основной контент;
   - находит ресурсы;
   - скачивает ресурсы в контексте браузерной сессии;
   - строит markdown;
   - строит attachment manifest.
4. Extension отправляет пакет в Obsidian plugin.
5. Plugin:
   - создает директорию вложений;
   - пишет файлы;
   - переписывает markdown;
   - создает note;
   - возвращает отчет.
6. Extension показывает итог: `success` / `partial` / `failed`.

## 13.3. Формат обмена

### CapturePackage
```json
{
  "version": "1.0",
  "source": {
    "url": "https://example.com/article/123",
    "title": "Page title",
    "capturedAt": "2026-04-14T10:00:00Z"
  },
  "note": {
    "pathHint": "Clippings/2026-04-14 Page title.md",
    "markdown": "# Page title\n\n..."
  },
  "attachments": [
    {
      "id": "att_001",
      "originalUrl": "https://example.com/image.jpg",
      "mimeType": "image/jpeg",
      "suggestedName": "image-001.jpg",
      "sha256": "optional",
      "dataBase64": "..."
    }
  ],
  "linkMap": [
    {
      "from": "https://example.com/image.jpg",
      "attachmentId": "att_001"
    }
  ],
  "options": {
    "rewriteMode": "wikilink",
    "deduplicate": true
  }
}
```

---

## 14. Функциональные требования

### FR-01. Новый режим клиппинга
В UI extension должен появиться новый action:
- `Clip with local assets`

**Критерий:** доступен наряду со стандартным clip.

### FR-02. Обнаружение ресурсов
Система должна находить:
- `img[src]`
- `img[srcset]`
- `picture source[srcset]`
- CSS `background-image` в пределах основного контента

**Критерий:** не менее 90% видимых article-images на типовой странице попадают в список discovery.

### FR-03. Скачивание ресурсов с учетом сессии
Extension должен использовать браузерный контекст и текущую сессию для скачивания ресурсов.

**Критерий:** изображения, доступные в открытой браузерной сессии, сохраняются локально без дополнительного логина.

### FR-04. Контроль списка вложений
Перед сохранением пользователь может:
- снять галочку с отдельных вложений;
- увидеть размер / mime type / источник;
- выбрать `save all` по умолчанию.

### FR-05. Передача бинарных вложений
Extension должен передавать в plugin:
- markdown;
- attachment metadata;
- binary payload.

**Критерий:** пакет атомарно валидируется на стороне plugin.

### FR-06. Сохранение в vault
Plugin должен:
- создать папку note/attachments;
- записать файлы;
- обработать конфликты имен;
- сохранить note.

### FR-07. Переписывание ссылок
Plugin должен заменить внешние ссылки в markdown на:
- `![[filename.ext]]`, или
- `![](relative/path.ext)`

на основании пользовательской настройки.

### FR-08. Дедупликация
При включенной опции plugin должен:
- вычислять hash;
- переиспользовать уже существующий файл, если hash совпадает.

### FR-09. Частичный успех
Если часть вложений не скачалась:
- note все равно сохраняется;
- в note metadata и UI показывается список failed assets.

### FR-10. Отчет о результате
После завершения пользователь должен увидеть:
- note path;
- saved count;
- failed count;
- skipped count;
- deduplicated count.

### FR-11. Настройки
Минимальные настройки:
- default note folder;
- default attachment folder;
- rewrite mode: wikilink / relative markdown;
- deduplicate on/off;
- keep source URL in frontmatter;
- max attachment size;
- include background images on/off.

### FR-12. Совместимость со стандартным Web Clipper
Форк не должен ломать обычный сценарий клиппинга без локальных ассетов.

---

## 15. Нефункциональные требования

### NFR-01. Безопасность
Система не должна:
- логировать cookies;
- сохранять auth headers;
- включать session tokens в markdown, frontmatter или telemetry.

### NFR-02. Производительность
Целевое время для типовой статьи:
- до 20 изображений;
- общий объем до 25 МБ;
- preview ≤ 2 сек до старта скачивания;
- full clip ≤ 10 сек на нормальном соединении.

### NFR-03. Надежность
- при падении на одном файле остальные продолжают обрабатываться;
- note не теряется при частичной ошибке.

### NFR-04. Наблюдаемость
Диагностические логи должны содержать только:
- тип ошибки;
- домен;
- mime type;
- размер;
- код ответа;
- этап пайплайна.

Запрещено логировать токены, cookies, auth headers, закрытый контент страницы целиком.

### NFR-05. Расширяемость
Протокол обмена должен быть versioned и обратимо расширяемым.

---

## 16. UX / UI

## 16.1. В extension
### Экран preview
Показывать:
- title;
- note path;
- число найденных вложений;
- список вложений с checkbox;
- общий размер;
- toggle `download images locally`.

### Кнопки
- `Save to Obsidian`
- `Save without assets`
- `Cancel`

### Статусы
- `Discovering assets...`
- `Downloading 4/12...`
- `Sending to Obsidian...`
- `Saved with warnings`
- `Failed`

## 16.2. В Obsidian plugin
### Settings
- Attachment location strategy:
  - same folder as note;
  - `_assets/<note-name>/`;
  - global folder.
- Link style:
  - wikilink;
  - markdown relative.
- Conflict strategy:
  - rename;
  - overwrite;
  - deduplicate by hash.
- Failure policy:
  - save note anyway;
  - abort on any asset error.

---

## 17. Формат frontmatter

```yaml
---
source_url: https://example.com/article/123
source_title: Example article
captured_at: 2026-04-14T10:00:00Z
clipper_mode: local-assets
assets_saved: 8
assets_failed: 1
---
```

---

## 18. Error model

### Типы ошибок
- `DISCOVERY_FAILED`
- `FETCH_FAILED`
- `FETCH_FORBIDDEN`
- `FETCH_TIMEOUT`
- `PAYLOAD_TOO_LARGE`
- `PLUGIN_UNAVAILABLE`
- `WRITE_FAILED`
- `REWRITE_FAILED`
- `MANIFEST_INVALID`

### Поведение
- `FETCH_FAILED`: сохраняем note, логируем failed asset;
- `PLUGIN_UNAVAILABLE`: показываем retry и fallback `copy markdown only`;
- `PAYLOAD_TOO_LARGE`: предлагаем снизить выбор вложений;
- `WRITE_FAILED`: откатываем только текущий файл или помечаем transaction partial.

---

## 19. Security & Privacy

### Требования
- никакие credentials не уходят за пределы локальной машины;
- отсутствует облачный relay;
- телеметрия по умолчанию выключена;
- debug mode требует явного включения;
- содержимое закрытой страницы не отправляется третьим сторонам.

### Threat model
#### Риски
- случайное сохранение чувствительного изображения;
- утечка токенизированных URL в frontmatter или лог;
- XSS/unsafe markdown injection из HTML;
- path traversal через имя файла.

#### Снижение
- sanitize HTML → markdown;
- redaction query strings в диагностике;
- список вложений перед сохранением;
- локальная-only архитектура;
- sanitize file names;
- запрет записи вне vault-папок.

---

## 20. Success metrics

### Product metrics
- % successful clips with at least one protected image saved locally;
- % partial success;
- average clip duration;
- average assets per clip;
- % duplicate assets reused.

### Quality metrics
- note render success rate;
- broken image rate after save;
- error rate by domain pattern.

### Целевые ориентиры v1
- full or partial success ≥ 85% на тестовом наборе сайтов;
- broken local image rate < 3%;
- crash-free sessions ≥ 99%.

---

## 21. Acceptance criteria

### AC-01
Если пользователь клиппирует страницу с 5 защищенными изображениями, доступными в браузере после логина, то в vault создается note и минимум 5 локальных файлов, а markdown ссылается на локальные вложения.

### AC-02
Если 2 из 10 изображений недоступны, то note сохраняется, 8 файлов пишутся, 2 ошибки отражаются в отчете.

### AC-03
Если плагин Obsidian не установлен или неактивен, extension показывает понятную ошибку и не теряет подготовленный markdown.

### AC-04
Если файл с тем же hash уже существует и включена deduplication, повторный файл не создается.

### AC-05
Если включен режим wikilink, итоговый markdown использует `![[...]]`.

---

## 22. MVP plan

### Phase 1 — MVP
- форк клиппера;
- новый action `Clip with local assets`;
- discovery `img/src/srcset`;
- fetch + base64 package;
- Obsidian plugin receiver;
- file save;
- markdown rewrite;
- partial success report.

### Phase 2
- CSS background images;
- dedup by hash;
- conflict policies;
- preview selection UI;
- better diagnostics.

### Phase 3
- retry strategy;
- lazy-load heuristics;
- site-specific adapters;
- batch clip;
- export capture manifest.

---

## 23. Техническая реализация по модулям

## 23.1. Browser fork
Предполагаемый стек:
- TypeScript;
- existing Web Clipper codebase;
- browser extension APIs;
- message passing;
- fetch / blob / ArrayBuffer / base64 conversion.

### Папки
```text
/extension
  /src
    /capture
    /assets
    /transport
    /ui
    /shared
```

### Ключевые интерфейсы
```ts
interface DiscoveredAsset {
  id: string;
  url: string;
  type: "image" | "background";
  mimeType?: string;
  sizeBytes?: number;
  selected: boolean;
}

interface AttachmentPayload {
  id: string;
  originalUrl: string;
  mimeType: string;
  suggestedName: string;
  dataBase64: string;
  sha256?: string;
}
```

## 23.2. Obsidian plugin
Стек:
- TypeScript;
- Obsidian plugin API.

### Папки
```text
/obsidian-plugin
  /src
    /receiver
    /writer
    /rewrite
    /dedup
    /settings
    /types
```

### Ключевые сервисы
- `CaptureReceiver`
- `AttachmentWriter`
- `MarkdownRewriter`
- `HashDedupService`
- `ClipTransactionService`

---

## 24. Dev workflow для Kilo Code + z.ai GLM 5.1

### Рекомендуемый режим работы
- **GLM 5.1**: архитектура, сложные рефакторинги, cross-module changes, протокол обмена, тестовая стратегия.
- более легкие модели: рутинные правки, boilerplate, простые unit tests, мелкие UI-изменения.

### Рабочие эпики для coding agent
1. Bootstrap monorepo
2. Implement capture manifest schema
3. Implement asset discovery
4. Implement asset fetch pipeline
5. Implement Obsidian receiver plugin
6. Implement markdown rewrite
7. Implement deduplication
8. Add e2e tests
9. Add settings UI
10. Prepare release builds

### Рекомендуемая структура репозитория
```text
/authclip
  /apps
    /clipper-fork
    /obsidian-plugin
  /packages
    /shared-types
    /markdown-utils
    /asset-utils
    /test-fixtures
  /docs
    prd.md
    architecture.md
    decisions.md
    test-plan.md
```

### Engineering rules for agent
- не менять public API shared-types без обновления обеих сторон;
- каждое изменение сопровождается test/update;
- сначала schema, затем transport, затем write-path;
- не писать production code без error typing;
- все места с auth-sensitive data покрывать redaction rules.

---

## 25. Definition of Done

Фича считается готовой, если:
- код в двух приложениях собирается;
- unit tests зеленые;
- e2e сценарии на 3 тестовых сайтах проходят;
- note создается с локальными вложениями;
- partial failure корректно отображается;
- нет утечки токенов в логах;
- есть README по установке и локальной отладке.

---

## 26. Test strategy

### Unit tests
- asset URL normalization;
- filename sanitizer;
- markdown rewrite correctness;
- manifest validation;
- hash dedup logic.

### Integration tests
- extension package generation;
- plugin package ingest;
- save + rewrite + result report.

### E2E tests
Сценарии:
1. публичная статья с 3 картинками;
2. авторизованная статья с 5 картинками;
3. lazy-loaded content;
4. одна битая картинка из пяти;
5. duplicate image across two clips.

### Security tests
- token redaction;
- logs do not contain auth headers;
- unsafe filename handling;
- path traversal prevention.

---

## 27. Риски

### Риск 1: сложные сайты с нестандартной загрузкой изображений
Снижение: phased support + site adapters.

### Риск 2: слишком большой payload
Снижение: preview selection + max size cap + chunked transport later.

### Риск 3: несовместимость с обновлениями upstream clipper
Снижение: минимально инвазивный fork, abstraction layer, регулярный rebase.

### Риск 4: расхождения между markdown extractor и attachment mapper
Снижение: единый canonical asset map.

### Риск 5: пользователь ожидает “сохранить вообще всё”
Снижение: честный UX — показывать, что именно было сохранено и что нет.

---

## 28. Open questions

1. Нужен ли transport через localhost endpoint или только через Obsidian URI / command bridge?
2. Какой максимальный payload допустим без chunking?
3. Нужна ли поддержка вложенных iframes в v2?
4. Нужно ли сохранять favicon / og:image отдельно?
5. Стоит ли делать режим `inline as data URI` как fallback?
6. Нужна ли batch clipping queue?

---

## 29. Release recommendation

### Версия v0.1.0
- internal alpha;
- 3–5 тестовых сайтов;
- ручная установка plugin + extension fork.

### Версия v0.2.0
- beta;
- настройки путей;
- partial failure UX;
- dedup.

### Версия v1.0.0
- стабильный transport;
- e2e coverage;
- документация;
- migration notes from standard clipper.

---

## 30. Стартовый prompt для Kilo Code

```text
You are the lead engineer for a monorepo that contains:
1) a fork of Obsidian Web Clipper browser extension
2) a companion Obsidian desktop plugin

Goal:
Implement a new clipping mode called "Clip with local assets" that downloads protected images while the page is open in an authenticated browser session, sends note + attachments to Obsidian, stores files locally in the vault, and rewrites markdown image references to local links.

Constraints:
- TypeScript only
- Keep architecture modular
- Do not log tokens/cookies/auth headers
- Favor partial success over total failure
- Shared manifest schema between extension and plugin
- All significant changes require tests
- Start by proposing repo structure, shared types, transport protocol, and MVP task breakdown

Output format:
1. architecture proposal
2. repo tree
3. interfaces/types
4. phased implementation plan
5. first PR scope
```

---

## 31. Пакет prompts для z.ai GLM 5.1

### Prompt 1 — architecture
```text
Design the architecture for a browser extension fork + Obsidian plugin that exchange markdown and binary attachments. Produce:
- component diagram in text
- shared manifest schema
- failure model
- MVP scope
Do not write code yet.
```

### Prompt 2 — shared types
```text
Create shared TypeScript types for CapturePackage, AttachmentPayload, ResultReport, and settings models. Include zod validation if helpful.
```

### Prompt 3 — extension MVP
```text
Implement the MVP browser-side asset discovery and attachment packaging flow for img/src/srcset, with clean separation between discovery, fetch, and package building.
```

### Prompt 4 — plugin MVP
```text
Implement the Obsidian plugin receiver that ingests a capture package, writes attachments to disk, rewrites markdown image URLs to local wikilinks, and creates the note.
```

### Prompt 5 — tests
```text
Add unit and integration tests for manifest validation, markdown rewriting, filename sanitization, and duplicate attachment handling.
```

---

## 32. Backlog v1

### Epic 1. Shared protocol
- описать `CapturePackage`;
- описать `ResultReport`;
- versioning;
- manifest validation.

### Epic 2. Browser capture
- article extraction;
- asset discovery;
- resource selection;
- fetch protected assets;
- base64 packaging.

### Epic 3. Obsidian ingest
- receive package;
- validate;
- save assets;
- rewrite markdown;
- create note.

### Epic 4. Settings and UX
- attachment folder settings;
- rewrite mode settings;
- conflict strategy;
- diagnostics UI.

### Epic 5. Quality and hardening
- tests;
- token redaction;
- payload size safeguards;
- error recovery.

---

## 33. Definition of Ready

Задача попадает в разработку, если:
- описан expected user flow;
- указан input/output контракт;
- понятен failure mode;
- понятен тестовый сценарий;
- согласованы изменения shared schema;
- нет неразрешенной архитектурной зависимости, блокирующей разработку.

---

## 34. Ready-for-Dev summary

### Что строим
Форк браузерного Web Clipper + companion plugin для Obsidian.

### Для кого
Для пользователей, которые сохраняют контент с сайтов, требующих авторизацию.

### Главная ценность
Локальное и автономное сохранение note + картинок, без зависимостей от истечения web-сессии.

### Главный MVP outcome
После клиппинга пользователь получает `.md`-заметку и локальные файлы изображений внутри vault, а заметка корректно открывается без доступа к исходному сайту.

---

## 35. Следующий документ после PRD

После утверждения этого PRD команда должна подготовить:
1. `architecture.md`
2. `shared-schema.md`
3. `test-plan.md`
4. `implementation-backlog.md`
5. `security-checklist.md`

