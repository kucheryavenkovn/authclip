# GRACE — Что фреймворк знает о проекте AuthClip

## Обзор

GRACE (Governed Reactive Architecture for Code Engineering) — это методология управления разработкой через формализованные артефакты. Каждый артефакт — это XML-документ в `docs/`, который служит единой точкой правды для агентов (LLM), работающих с кодом. AGENTS.md в корне — это протокол, которому подчиняются все агенты.

Ниже — описание того, что именно GRACE знает о проекте AuthClip, по каждому файлу.

---

## 1. AGENTS.md — Инженерный протокол

**Назначение:** Корневой файл, который загружается в контекст каждого агента. Определяет правила игры.

**Что GRACE знает отсюда:**

- **Ключевые слова проекта:** obsidian, web-clipper, browser-extension, asset-discovery, markdown-rewrite, local-first, attachment-writer
- **Аннотация:** AuthClip — это форк Obsidian Web Clipper + companion plugin, который сохраняет изображения и вложения с авторизованных страниц как локальные файлы vault
- **6 принципов работы:**
  1. Никакого кода без контракта (MODULE_CONTRACT)
  2. Семантическая разметка — это навигационная структура (START_BLOCK / END_BLOCK)
  3. Граф знаний всегда актуален
  4. Верификация — первоклассный артефакт
  5. Сверху вниз: требования → стек → план → верификация → код
  6. Управляемая автономия: агенты свободны в «как», но не в «что»
- **Формат семантической разметки** на уровне модуля, функции и блока
- **Конвенция логирования:** `[Module][function][BLOCK_NAME]` с обязательной редакцией секретов
- **Правила модификаций:** читать контракт перед редактированием, обновлять граф знаний при изменении модулей, обновлять план верификации при изменении тестов

---

## 2. docs/requirements.xml — Требования

**Назначение:** Продуктовые требования, пользовательские сценарии, ограничения и риски.

**Что GRACE знает отсюда:**

### Роли пользователей
- **KnowledgeWorker** — клипирует статьи с авторизованных сайтов
- **Researcher** — архивирует знания из внутренних порталов, helpdesk, LMS
- **PowerUser** — управляет шаблонами имен, путями, форматом ссылок, дедупликацией

### 6 пользовательских сценариев (Use Cases)
| ID | Сценарий | Приоритет |
|---|---|---|
| UC-001 | Клипирование авторизованной страницы с локальными ассетами | high |
| UC-002 | Просмотр и отбор вложений перед сохранением | high |
| UC-003 | Частичный успех при ошибках скачивания | high |
| UC-004 | Настройка папок, стиля ссылок и политики дедупликации | medium |
| UC-005 | Дедупликация изображений по hash | medium |
| UC-006 | Fallback при недоступности плагина | high |

### Чего НЕТ в v1 (Non-Goals)
- Видео и потоковые медиа
- Полный краулинг сайтов
- OCR и рендеринг PDF
- Автоматический re-login
- Обход DRM/CAPTCHA
- Мобильная поддержка
- Облачный бэкенд, мультипользовательский режим

### Ограничения
- Только локальная работа — никакого облачного relay
- Секреты никогда не попадают в логи, markdown, frontmatter или телеметрию
- Payload ограничен: до 20 изображений, ~25 МБ
- Chrome/Edge + Obsidian Desktop на Windows/macOS/Linux
- Форк не ломает стандартный Web Clipper

### Риски
1. Нестандартная загрузка изображений (lazy-load, JS-injected src)
2. Слишком большие payload
3. Конфликты с upstream Web Clipper
4. Расхождение между извлечением markdown и маппингом URL
5. Path traversal и небезопасные имена файлов
6. XSS через несанированный HTML

### Открытые вопросы
- Транспорт: localhost HTTP vs Obsidian URI vs command bridge?
- Максимальный payload до необходимости chunking?
- Поддержка вложенных iframe в v2?
- Сохранять ли favicon/og:image отдельно?
- Режим inline data URI как fallback?
- Очередь batch clipping?

---

## 3. docs/technology.xml — Технологический стек

**Назначение:** Фиксация стека, версий, инструментов и наблюдаемости.

**Что GRACE знает отсюда:**

### Стек
- **Runtime:** Node.js >= 20.0.0
- **Язык:** TypeScript 5.6+ (target ES2022, модули ESNext, moduleResolution bundler)
- **Фреймворки:** Obsidian Plugin API (latest) + Chrome Extension APIs (MV3)

### Ключевые зависимости
| Библиотека | Версия | Назначение |
|---|---|---|
| zod | ^3.23.0 | Runtime-валидация схем (CapturePackage, ResultReport, Settings) |
| dayjs | ^1.11.13 | Форматирование дат в шаблонах и frontmatter |
| defuddle | ^0.16.0 | Извлечение контента статьи из веб-страниц |
| dompurify | ^3.4.0 | Санитизация HTML перед конвертацией в markdown |
| esbuild | ^0.28.0 | Бандлинг плагина и расширения |
| webpack | ^5.106.1 | Production-сборка браузерного расширения |
| vitest | ^3.0.0 | Тест-раннер для всех пакетов |

### Инструменты
- **Workspace:** pnpm workspaces 9.x
- **Бандлер плагина:** esbuild 0.28.x
- **Бандлер расширения:** webpack 5.x
- **Линтер:** `tsc --noEmit` (нет отдельного ESLint)
- **Форматтер:** нет
- **Тест-раннер:** vitest 3.x

### Стратегия тестирования
- **Модульный уровень:** `pnpm --filter <package> test` — быстрые детерминированные тесты
- **Уровень волны:** `pnpm -r --stream test` — интеграция затронутых поверхностей
- **Уровень фазы:** `pnpm test` — полная регрессия монорепо
- **Мокинг:** предпочтение фейкам и узким стабам, jsdom для DOM-тестов

### Наблюдаемость
- **Логгер:** console-based structured logging (нет отдельной библиотеки)
- **Формат логов:** `[Module][function][BLOCK_NAME] message`
- **Обязательные поля:** correlationId, phase, assetCount, resultStatus
- **Редакция:** никогда не логировать токены, cookies, auth headers, session tokens

### Форма поставки
Локальный монорепо. Расширение — Chrome/Edge MV3. Плагин — manual-install .zip. Без облака.

---

## 4. docs/development-plan.xml — План разработки

**Назначение:** Модули, их контракты, потоки данных, порядок реализации и политика выполнения.

**Что GRACE знает отсюда:**

### 4 модуля

#### M-SHARED-TYPES (Layer 0, UTILITY)
- **Путь:** `packages/shared-types/src/index.ts`
- **Назначение:** Общие TypeScript-типы, Zod-схемы и константы
- **Экспорты:** CapturePackage, AttachmentPayload, ResultReport, ClipSettings, validateCapturePackage
- **Зависимости:** нет
- **Ошибки:** VALIDATION_FAILED

#### M-TEMPLATE-ENGINE (Layer 1, CORE_LOGIC)
- **Путь:** `packages/template-engine/src/index.ts`
- **Назначение:** Рендеринг шаблонов имен заметок и контента с 50+ фильтрами
- **Экспорты:** renderTemplate, tokenize
- **Зависимости:** M-SHARED-TYPES
- **Ошибки:** TEMPLATE_PARSE_ERROR, FILTER_NOT_FOUND

#### M-CLIPPER-FORK (Layer 2, ENTRY_POINT)
- **Путь:** `apps/clipper-fork/src/`
- **Назначение:** Браузерное расширение — обнаружение, скачивание и упаковка ассетов
- **Экспорты:** discoverAssets, fetchAsset, buildCapturePackage, sendToObsidian
- **Зависимости:** M-SHARED-TYPES, M-TEMPLATE-ENGINE
- **Ошибки:** DISCOVERY_FAILED, FETCH_FAILED, FETCH_FORBIDDEN, FETCH_TIMEOUT, PAYLOAD_TOO_LARGE, PLUGIN_UNAVAILABLE

#### M-OBSIDIAN-PLUGIN (Layer 2, ENTRY_POINT)
- **Путь:** `apps/obsidian-plugin/src/`
- **Назначение:** Obsidian-плагин — прием пакетов, запись вложений, перезапись markdown, создание заметок
- **Экспорты:** receiveCapturePackage, writeAttachments, rewriteMarkdown, dedupByHash, createNote
- **Зависимости:** M-SHARED-TYPES
- **Ошибки:** MANIFEST_INVALID, WRITE_FAILED, REWRITE_FAILED

### 4 потока данных

#### DF-CLIP_FULL — Полный клип
1. Расширение находит ассеты (img, srcset, picture, background-image)
2. Пользователь отбирает нужные в preview UI
3. Расширение скачивает ассеты в контексте браузерной сессии
4. Формирует CapturePackage (markdown + attachments + linkMap)
5. Отправляет в Obsidian-плагин через транспорт
6. Плагин валидирует манифест
7. Проверяет дедуп по hash (если включен)
8. Записывает файлы вложений в vault
9. Перезаписывает URL в markdown на локальные ссылки
10. Создает заметку
11. Возвращает ResultReport
12. Расширение показывает итог пользователю

#### DF-CLIP_PARTIAL — Частичный успех
При ошибке скачивания части ассетов: заметка сохраняется, неудачные ассеты попадают в frontmatter и отчет.

#### DF-DEDUP — Дедупликация
SHA-256 hash совпадает с существующим файлом → пропускаем запись, ссылаемся на существующий.

#### DF-PLUGIN_UNAVAILABLE — Плагин недоступен
Расширение показывает ошибку и предлагает "Copy markdown only" fallback.

### 4 фазы реализации

| Фаза | Название | Цель | Статус |
|---|---|---|---|
| Phase-1 | Shared Protocol & Types | Типы, схемы, валидация | pending |
| Phase-2 | Browser Capture MVP | Обнаружение, скачивание, упаковка ассетов | pending |
| Phase-3 | Obsidian Plugin MVP | Приемник, запись, перезапись, создание заметок | pending |
| Phase-4 | Integration & Polish | Дедуп, UI, настройки, безопасность | pending |

### Политика выполнения
- **Профиль:** balanced
- **Контроллер владеет:** development-plan.xml, knowledge-graph.xml, verification-plan.xml
- **Воркер владеет:** только исходники модулей и локальные тесты в рамках утвержденного scope

---

## 5. docs/knowledge-graph.xml — Граф знаний

**Назначение:** Навигационная карта проекта для агентов. Уникальные ID-теги вместо обобщенных тегов.

**Что GRACE знает отсюда:**

### Узлы графа
- **M-SHARED-TYPES** → без зависимостей (базовый слой)
- **M-TEMPLATE-ENGINE** → зависит от M-SHARED-TYPES
- **M-CLIPPER-FORK** → зависит от M-SHARED-TYPES, M-TEMPLATE-ENGINE
- **M-OBSIDIAN-PLUGIN** → зависит от M-SHARED-TYPES

### Перекрестные связи (CrossLinks)
- M-CLIPPER-FORK → M-SHARED-TYPES: импортирует типы и схемы
- M-CLIPPER-FORK → M-TEMPLATE-ENGINE: использует для рендеринга заметок
- M-OBSIDIAN-PLUGIN → M-SHARED-TYPES: импортирует типы и схемы

### Публичные интерфейсы каждого модуля
Для каждого модуля перечислены его ключевые типы и функции с назначением. Агент может по графу определить, какие экспорты доступны и от каких модулей они зависят.

---

## 6. docs/verification-plan.xml — План верификации

**Назначение:** Стратегия тестирования, критические потоки, контракты верификации модулей, фазовые гейты.

**Что GRACE знает отсюда:**

### Глобальная политика
- Детерминированные проверки优先
- Формат логов: `[Module][function][BLOCK_NAME]`
- Редакция: никогда не логировать секреты

### 5 критических потоков верификации

| ID | Название | Сценарий | Приоритет |
|---|---|---|---|
| VF-001 | FullClipHappyPath | Клип с 5 картинками, все скачались, ссылки переписаны | high |
| VF-002 | PartialSuccess | 2 из 5 не скачались, заметка сохранена с отчетом | high |
| VF-003 | Deduplication | Hash совпал — дубль не создан | medium |
| VF-004 | PluginUnavailable | Плагин не отвечает — понятная ошибка + fallback | high |
| VF-005 | TokenRedaction | В логах и frontmatter нет токенов и cookies | high |

Для каждого потока определены обязательные log-маркеры и последовательности трассировки (trace sequences).

### Верификация модулей

Для каждого из 4 модулей определены:
- **Файлы тестов** (пути)
- **Команды проверки** (pnpm --filter ... test + typecheck)
- **Сценарии** (success/failure с описанием)
- **Обязательные log-маркеры**
- **Trace-утверждения** (например: "MANIFEST_INVALID не должен вызывать vault writes")
- **Wave и Phase follow-up** (что проверять на уровне волны и фазы)

Пример: для M-OBSIDIAN-PLUGIN описано 9 сценариев, включая path traversal, filename sanitization, partial success, dedup и wikilink/relative режимы перезаписи.

### 4 фазовых гейта

Каждый гейт содержит:
- Цель фазы
- Команды для проверки
- Требуемые доказательства

Финальный гейт (Phase-4) требует: дедуп работает, токены редуцированы, path traversal отклонен, все тесты зеленые.

---

## 7. docs/operational-packets.xml — Операционные пакеты

**Назначение:** Шаблоны для коммуникации между контроллером и воркерами во время выполнения.

**Что GRACE знает отсюда:**

### 4 типа пакетов

1. **ExecutionPacket** — контроллер → воркер
   - module-id, module-name, purpose
   - write-scope (список файлов, которые воркер имеет право трогать)
   - contract-excerpt (выдержка из контракта модуля)
   - graph-entry-excerpt (выдержка из графа знаний)
   - dependency-contract-summaries (контракты зависимостей)
   - verification-excerpt (выдержка из плана верификации)
   - expected-graph-delta-fields и expected-verification-delta-fields

2. **GraphDelta** — воркер → контроллер
   - imports-added/removed
   - exports-added/removed
   - annotations-added/removed
   - cross-links-added/removed
   - Только реально изменившиеся факты

3. **VerificationDelta** — воркер → контроллер
   - test-files-added/removed
   - module-checks (команды)
   - required-log-markers
   - required-trace-assertions
   - wave-follow-up и phase-follow-up

4. **FailurePacket** — верификатор → фиксер
   - scenario, contract-ref
   - expected-evidence vs observed-evidence
   - first-divergent-block
   - suggested-next-action

---

## Сводка: что GRACE знает о проекте

| Аспект | Детали |
|---|---|
| **Продукт** | AuthClip — форк Web Clipper + Obsidian-плагин для локального сохранения картинок с авторизованных сайтов |
| **Архитектура** | Монорепо (pnpm workspaces), 2 приложения + 2 shared-пакета |
| **Стек** | TypeScript 5.6+, Node 20+, ES2022, Vitest 3, Zod 3, esbuild, webpack |
| **Модули** | shared-types (layer 0) → template-engine (layer 1) → clipper-fork + obsidian-plugin (layer 2) |
| **Потоки данных** | Полный клип (12 шагов), частичный успех, дедуп, fallback при недоступности плагина |
| **Критические проверки** | Happy path, partial success, dedup, plugin unavailable, token redaction |
| **Фазы** | 4 фазы: типы → browser MVP → plugin MVP → интеграция и безопасность |
| **Безопасность** | Редакция всех секретов в логах, санитизация filenames, защита от path traversal |
| **Поставка** | Локально, без облака, Chrome/Edge MV3 + Obsidian manual-install .zip |
