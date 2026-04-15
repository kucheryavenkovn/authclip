# GRACE — Что фреймворк знает о проекте AuthClip

## Обзор

GRACE (Governed Reactive Architecture for Code Engineering) — методология управления разработкой через формализованные артефакты. Каждый артефакт — XML-документ в `docs/`, единая точка правды для агентов. `AGENTS.md` в корне — протокол, которому подчиняются все агенты.

---

## История изменений

### v0.3.0 → v0.3.0-current (дельта от предыдущего состояния grace.md)

Предыдущая версия grace.md описывала **начальное** состояние — GRACE-артефакты только что инициализированы, фазы все "pending", граф знаний покрывал ~13% экспортов. Ниже — что изменилось с тех пор.

#### Артефакты

| Артефакт | Было | Стало |
|---|---|---|
| `requirements.xml` | 6 use cases, 5 constraints, открытый вопрос о транспорте | **8 use cases** (+UC-007 auth token, +UC-008 health endpoint), **7 constraints** (+127.0.0.1 only, +HTTP transport), вопрос о транспорте **решён** |
| `development-plan.xml` | 4 модуля, все фазы "pending", `validateCapturePackage` в shared-types, `dedupByHash` как реализованный | Фазы **1-3 → done**, `validateCapturePackage` **перемещён в M-OBSIDIAN-PLUGIN**, `dedupByHash` → **Phase-4 pending**, транспорт задокументирован (localhost HTTP port 27124) |
| `knowledge-graph.xml` | 4 модуля, ~4 аннотации (13% покрытия) | 4 модуля, **30+ аннотаций**, все публичные экспорты покрыты, CrossLinks актуальны |
| `verification-plan.xml` | 5 критических потоков, 9 сценариев для plugin | **7 критических потоков** (+VF-006 auth rejection, +VF-007 manifest validation), **17+ сценариев для plugin**, фазовые гейты обновлены |
| `technology.xml` | Без изменений | Без изменений (был точен изначально) |
| `operational-packets.xml` | Без изменений | Без изменений (шаблон) |

#### Разметка исходного кода

| Метрика | Было | Стало |
|---|---|---|
| Файлы с MODULE_CONTRACT | 0 | **27** |
| Семантические блоки (START/END_BLOCK) | 0 | **9 пар** (0 непарных) |
| CHANGE_SUMMARY | 0 | **2** |

Покрытие GRACE-разметкой: 26 из 27 AuthClip-файлов (96%). Один файл без контракта: `clip-transaction.ts` (есть MODULE_MAP и блоки, но нет MODULE_CONTRACT — отмечено в grace-status.md).

Не размечены намеренно:
- 7 upstream-файлов clipper-fork (content.ts, background.ts, html-to-markdown.ts, popup.ts, dom-utils.ts, highlighter.ts, highlighter-overlays.ts)
- 50+ файлов фильтров template-engine
- Внутренние файлы template-engine (resolver.ts, shared.ts, parser-utils.ts и т.д.)
- .d.ts файлы

#### Тестовое покрытие

| Пакет | Тесты есть? |
|---|---|
| shared-types | ❌ 0 файлов (директория не существует) |
| template-engine | ✅ 51 файл (3 `__tests__` + 48 co-located filter tests) |
| clipper-fork | ❌ 0 файлов |
| obsidian-plugin | ❌ 0 файлов |

verification-plan.xml описывает 39 сценариев, но только template-engine покрыт тестами.

#### Инфраструктура

| Что | Было | Стало |
|---|---|---|
| GitHub Actions | Нет | `.github/workflows/release.yml` — авто-релиз при push в master |
| Релизы | Нет | [v0.2.0](https://github.com/kucheryavenkovn/authclip/releases/tag/v0.2.0) — Chrome extension + Obsidian plugin zip |
| grace-status.md | Нет | Здоровый отчёт с метриками |

#### Исправленные баги

- **LinkMapEntry**: тип имел поле `path`, а Zod-схема и все использования — `from`. Исправлено: `path` → `from`.

---

## Текущее состояние артефактов

### 1. AGENTS.md — Инженерный протокол

Корневой файл, загружаемый в контекст каждого агента.

**Содержимое:**
- Ключевые слова: obsidian, web-clipper, browser-extension, asset-discovery, markdown-rewrite, local-first, attachment-writer
- 6 принципов GRACE
- Формат семантической разметки (модуль → функция → блок)
- Конвенция логирования `[Module][function][BLOCK_NAME]`
- Правила модификаций (читать контракт → редактировать → обновить граф → обновить верификацию)

### 2. docs/requirements.xml — v0.3.0

**8 пользовательских сценариев:**

| ID | Сценарий | Приоритет |
|---|---|---|
| UC-001 | Клипирование авторизованной страницы с локальными ассетами | high |
| UC-002 | Просмотр и отбор вложений перед сохранением | high |
| UC-003 | Частичный успех при ошибках скачивания | high |
| UC-004 | Настройка папок, стиля ссылок и дедупликации | medium |
| UC-005 | Дедупликация изображений по hash | medium |
| UC-006 | Fallback при недоступности плагина | high |
| UC-007 | Настройка auth token для защиты HTTP-эндпоинта | medium |
| UC-008 | Проверка доступности плагина через /v1/health | medium |

**7 ограничений:**
1. Только локальная работа
2. Секреты никогда в логах/markdown/frontmatter
3. Payload: до 50 МБ HTTP body, 25 МБ на вложение
4. Chrome/Edge + Obsidian Desktop
5. Форк не ломает стандартный Web Clipper
6. HTTP-сервер только на 127.0.0.1
7. Транспорт: localhost HTTP (порт 27124), опциональный X-AuthClip-Token

**Решённый вопрос:** транспорт — localhost HTTP endpoint (не Obsidian URI, не command bridge).

### 3. docs/technology.xml — v0.2.0

Стек без изменений. Ключевые зависимости: TypeScript 5.6+, Zod ^3.23, esbuild ^0.28, webpack ^5.106, vitest ^3.0, dayjs, defuddle, dompurify.

### 4. docs/development-plan.xml — v0.3.0

**4 модуля, 4 фазы:**

| Фаза | Название | Статус |
|---|---|---|
| Phase-1 | Shared Protocol & Types | **done** |
| Phase-2 | Browser Capture MVP | **done** |
| Phase-3 | Obsidian Plugin MVP | **done** |
| Phase-4 | Integration & Polish | pending |

**4 потока данных:**
- DF-CLIP_FULL — полный клип (14 шагов)
- DF-CLIP_PARTIAL — частичный успех
- DF-DEDUP — дедупликация (пока name conflict via generateSafeName, hash — Phase-4)
- DF-PLUGIN_UNAVAILABLE — fallback при недоступности

**Ключевые архитектурные решения:**
- HTTP localhost (порт 27124), не Obsidian URI
- Дедуп: только name conflict (generateSafeName counter), SHA-256 hash — Phase-4
- Frontmatter: source_title, source_url, captured_at, clipper_mode, author, description, published, site_name, domain, language, word_count, assets_saved, assets_failed
- VaultAdapter — интерфейс с ObsidianVaultAdapter как реализация (тестируемость)

### 5. docs/knowledge-graph.xml — v0.3.0

**30+ аннотаций** покрывают все публичные экспорты:

| Модуль | Зависимости | Аннотаций |
|---|---|---|
| M-SHARED-TYPES | нет | 16 |
| M-TEMPLATE-ENGINE | M-SHARED-TYPES | 18 |
| M-CLIPPER-FORK | M-SHARED-TYPES, M-TEMPLATE-ENGINE | 12 |
| M-OBSIDIAN-PLUGIN | M-SHARED-TYPES | 18 |

**3 CrossLink:**
- M-CLIPPER-FORK → M-SHARED-TYPES (imports types, schemas, sanitization)
- M-CLIPPER-FORK → M-TEMPLATE-ENGINE (uses for note rendering)
- M-OBSIDIAN-PLUGIN → M-SHARED-TYPES (imports types, schemas, result builder)

### 6. docs/verification-plan.xml — v0.3.0

**7 критических потоков:**

| ID | Название | Приоритет |
|---|---|---|
| VF-001 | FullClipHappyPath | high |
| VF-002 | PartialSuccess | high |
| VF-003 | NameConflictResolution | medium |
| VF-004 | PluginUnavailable | high |
| VF-005 | TokenRedaction | high |
| VF-006 | AuthTokenRejection | medium |
| VF-007 | ManifestValidation | high |

**39 тестовых сценариев** по модулям:
- V-M-SHARED-TYPES: 7 сценариев
- V-M-TEMPLATE-ENGINE: 5 сценариев
- V-M-CLIPPER-FORK: 10 сценариев
- V-M-OBSIDIAN-PLUGIN: 17 сценариев

**4 фазовых гейта** с командами и требуемыми доказательствами.

### 7. docs/operational-packets.xml — v0.1.0

Шаблон без изменений. 4 типа пакетов: ExecutionPacket, GraphDelta, VerificationDelta, FailurePacket.

---

## Следующие шаги

По результатам grace-status.md:

1. Добавить MODULE_CONTRACT в `clip-transaction.ts`
2. Написать тесты для shared-types (7 сценариев)
3. Написать тесты для obsidian-plugin (17 сценариев)
4. Написать тесты для clipper-fork (10 сценариев)
5. Запустить `$grace-verification` после появления тестов

---

## Сводка

| Аспект | Детали |
|---|---|
| **Продукт** | AuthClip — форк Web Clipper + Obsidian-плагин для локального сохранения картинок с авторизованных сайтов |
| **Архитектура** | Монорепо (pnpm), 2 приложения + 2 shared-пакета, 4 слоя |
| **Стек** | TypeScript 5.6+, Node 20+, Zod 3, esbuild, webpack, vitest 3 |
| **Реализация** | Фазы 1-3 готовы, Phase-4 pending (hash dedup, CSS bg, security) |
| **Разметка** | 27 файлов с контрактами, 9 семантических блоков, 0 непарных |
| **Тесты** | template-engine покрыт (51 тест), остальные 3 модуля — 0 тестов |
| **Безопасность** | Редакция секретов в логах, санитизация filenames, 127.0.0.1 only, опциональный auth token |
| **CI/CD** | GitHub Actions — авто-релиз при push в master |
| **Релизы** | v0.2.0 — Chrome extension + Obsidian plugin |
