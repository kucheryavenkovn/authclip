# AuthClip — Architecture

> Version: 1.0-draft
> Date: 2026-04-14
> Status: Proposal

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Diagram](#2-component-diagram)
3. [Component Responsibilities](#3-component-responsibilities)
4. [Data Flow](#4-data-flow)
5. [Shared Manifest Schema](#5-shared-manifest-schema)
6. [Transport Protocol](#6-transport-protocol)
7. [Failure Model](#7-failure-model)
8. [Security Model](#8-security-model)
9. [MVP Scope](#9-mvp-scope)
10. [Out of Scope for MVP](#10-out-of-scope-for-mvp)
11. [Key Architectural Decisions](#11-key-architectural-decisions)
12. [Open Questions](#12-open-questions)

---

## 1. System Overview

AuthClip is a two-part system:

1. **Browser Extension (clipper-fork)** — runs inside Chrome/Edge, on the authenticated page. Discovers content, downloads protected assets in the browser session, packages everything.
2. **Obsidian Plugin (obsidian-plugin)** — runs inside Obsidian Desktop. Receives the package, writes attachments to the vault, rewrites markdown to point to local files.

They communicate exclusively over **localhost HTTP**. No cloud relay, no third-party server, no data leaves the local machine.

The `@authclip/shared-types` package is the contract between them — a shared npm workspace package consumed by both sides.

---

## 2. Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER EXTENSION                            │
│                                                                     │
│  ┌─────────────────┐                                               │
│  │ Popup UI        │  Triggers clip action                         │
│  │ (preview/status)│◀──── displays progress/result ──────────┐     │
│  └────────┬────────┘                                           │     │
│           │ "Clip with local assets"                            │     │
│           ▼                                                    │     │
│  ┌─────────────────┐    ┌──────────────┐    ┌──────────────┐  │     │
│  │ Capture Pipeline │───▶│ Asset        │───▶│ Asset        │  │     │
│  │ (orchestrator)   │    │ Discovery    │    │ Fetcher      │  │     │
│  └────────┬─────────┘    └──────────────┘    └──────┬───────┘  │     │
│           │                                         │          │     │
│           │          ┌──────────────┐               │          │     │
│           │          │ Content      │               │          │     │
│           │◀─────────│ Extractor    │               │          │     │
│           │          │ (→ markdown) │               │          │     │
│           │          └──────────────┘               │          │     │
│           │                                         │          │     │
│           ▼                                         ▼          │     │
│  ┌─────────────────┐                       ┌──────────────┐   │     │
│  │ Manifest Builder │◀─────────────────────│ Fetch        │   │     │
│  │                 │  (fetched assets)      │ Result Map   │   │     │
│  └────────┬────────┘                       └──────────────┘   │     │
│           │ CapturePackage                                    │     │
│           ▼                                                    │     │
│  ┌─────────────────┐                                          │     │
│  │ Transport Client │───── HTTP POST ──────────────────────── ┘     │
│  │ (sender)        │  http://localhost:{port}/v1/capture          │
│  └─────────────────┘                                                │
│           │                                                         │
│           │  ◀── ResultReport (JSON response) ─────────────────────┘
└───────────┼─────────────────────────────────────────────────────────┘
            │
            │  localhost only
            │
┌───────────┼─────────────────────────────────────────────────────────┐
│           ▼                    OBSIDIAN PLUGIN                      │
│  ┌─────────────────┐                                                │
│  │ HTTP Receiver    │  Express-like micro server on localhost        │
│  │ (auth middleware)│  validates X-AuthClip-Token header             │
│  └────────┬────────┘                                                │
│           │ raw CapturePackage JSON                                  │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ Manifest         │  zod schema validation, version check          │
│  │ Validator        │                                                │
│  └────────┬────────┘                                                │
│           │ validated package                                        │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────┐            │
│  │ Clip Transaction Service (orchestrator)              │            │
│  │                                                      │            │
│  │  1. resolve attachment paths                         │            │
│  │  2. for each attachment:                             │            │
│  │     a. dedup check (optional)  ──▶ Hash Dedup Svc   │            │
│  │     b. write file              ──▶ Attachment Writer │            │
│  │  3. rewrite markdown URLs      ──▶ Markdown Rewriter│            │
│  │  4. write note file            ──▶ Attachment Writer │            │
│  │  5. build ResultReport                              │            │
│  └─────────────────────────────────────────────────────┘            │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ Settings Tab     │  Obsidian PluginSettingTab UI                  │
│  └─────────────────┘                                                │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                     @authclip/shared-types                          │
│                                                                     │
│  CapturePackage    ResultReport    ClipSettings    ClipErrorCode    │
│  AttachmentPayload DiscoveredAsset LinkMapEntry    AttachmentStatus │
│  RewriteMode                                                       │
│  sanitizeFilename()    generateSafeName()    DEFAULT_SETTINGS      │
│  zod runtime schemas for CapturePackage, ResultReport              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Responsibilities

### 3.1 Browser Extension

| Module | Responsibility |
|--------|---------------|
| **Popup UI** | Trigger clip, show preview of discovered assets, show progress, display result report |
| **Capture Pipeline** | Orchestrates the full clip flow: extract → discover → fetch → package → send |
| **Content Extractor** | Extracts readable article content from the page DOM, converts to markdown |
| **Asset Discovery** | Scans the article DOM for `img[src]`, `img[srcset]`, `picture source[srcset]`, optionally CSS `background-image`. Returns a list of `DiscoveredAsset` |
| **Asset Fetcher** | Downloads each selected asset using `fetch()` in the browser's page context (inherits cookies/session). Converts to base64. Handles errors per-asset |
| **Manifest Builder** | Assembles `CapturePackage` from extracted markdown + fetched assets + link map |
| **Transport Client** | Sends `CapturePackage` via HTTP POST to the plugin. Handles connection errors, retries, auth |
| **Log Redactor** | Strips tokens, cookies, auth headers, sensitive query params from any log output |

### 3.2 Obsidian Plugin

| Module | Responsibility |
|--------|---------------|
| **HTTP Receiver** | Listens on `localhost:{port}`, accepts POST `/v1/capture`, checks auth token |
| **Manifest Validator** | Validates incoming JSON against zod schema, checks version compatibility |
| **Clip Transaction Service** | Orchestrates: validate → write attachments → rewrite markdown → write note → build report. Tracks partial failures |
| **Attachment Writer** | Writes binary files to vault. Handles filename conflicts (rename/overwrite). Reports per-file success/failure |
| **Hash Dedup Service** | Computes SHA-256 of attachment data, checks against existing vault files. Returns existing path if duplicate found |
| **Markdown Rewriter** | Replaces external URLs in markdown with local references (`![[file.jpg]]` or `![](./path/file.jpg)`) based on settings |
| **Settings Tab** | Obsidian settings UI for port, auth token, folder paths, rewrite mode, dedup toggle, etc. |
| **Log Redactor** | Same as extension side — strips sensitive data from logs |

### 3.3 Shared Package

| Export | Purpose |
|--------|---------|
| `CapturePackage` | Wire format — the full package sent from extension to plugin |
| `ResultReport` | Wire format — the response from plugin to extension |
| `AttachmentPayload` | Single attachment within a package |
| `DiscoveredAsset` | Pre-fetch asset metadata (used by extension UI) |
| `LinkMapEntry` | Maps original URL → attachment ID |
| `AttachmentStatus` | Per-attachment result (saved/deduplicated/failed/skipped) |
| `ClipSettings` | Settings shape (used by plugin settings, referenced by extension for defaults) |
| `ClipErrorCode` | Enumerated error codes shared across both sides |
| `RewriteMode` | `wikilink` or `relative-markdown` |
| `CapturePackageSchema` | Zod schema for runtime validation |
| `ResultReportSchema` | Zod schema for runtime validation |
| `sanitizeFilename()` | Strips unsafe characters from filenames |
| `generateSafeName()` | Generates a unique safe name avoiding collisions |
| `DEFAULT_SETTINGS` | Default values for all settings |

---

## 4. Data Flow

```
User clicks "Clip with local assets"
        │
        ▼
┌─── Extension ────────────────────────────────────────────┐
│                                                           │
│  1. Content Extractor                                     │
│     DOM → article HTML → markdown string                 │
│                                                           │
│  2. Asset Discovery                                       │
│     scan DOM in article scope                             │
│     → DiscoveredAsset[]                                   │
│                                                           │
│  3. [UI] Show preview, user selects/deselects assets     │
│                                                           │
│  4. Asset Fetcher (parallel, with concurrency limit)      │
│     for each selected DiscoveredAsset:                    │
│       fetch(url) → blob → ArrayBuffer → base64           │
│       on error: mark failed, continue                    │
│     → AttachmentPayload[]  (only successfully fetched)   │
│     → failedAssetIds[]     (for report)                  │
│                                                           │
│  5. Manifest Builder                                      │
│     assemble CapturePackage {                             │
│       version: "1.0",                                     │
│       source: { url, title, capturedAt },                 │
│       note: { pathHint, markdown },                       │
│       attachments: AttachmentPayload[],                   │
│       linkMap: LinkMapEntry[],                            │
│       options: { rewriteMode, deduplicate, ... }          │
│     }                                                     │
│                                                           │
│  6. Transport Client                                      │
│     POST http://localhost:{port}/v1/capture               │
│     Headers: Content-Type: application/json               │
│               X-AuthClip-Token: <secret>                  │
│     Body: CapturePackage JSON                             │
│                                                           │
│     On network error → show "Plugin unavailable" UI       │
│                        offer "Copy markdown" fallback      │
│                                                           │
└───────────────────────────────────────────────────────────┘
        │
        ▼  HTTP 200 { ResultReport }
        │
┌─── Extension UI ──────────────────────────────────────────┐
│  Display result:                                          │
│    ✓ 8 attachments saved                                  │
│    ⚠ 1 deduplicated                                      │
│    ✗ 2 failed: image-003.jpg (FETCH_TIMEOUT),             │
│               image-007.jpg (FETCH_FORBIDDEN)             │
│    Note: Clippings/2026-04-14 Article title.md           │
└───────────────────────────────────────────────────────────┘


        │  Meanwhile, on the plugin side:
        ▼
┌─── Plugin ────────────────────────────────────────────────┐
│                                                           │
│  1. HTTP Receiver                                         │
│     validate auth token                                   │
│     parse JSON body                                       │
│                                                           │
│  2. Manifest Validator                                    │
│     zod parse against CapturePackageSchema                │
│     check version compatibility                           │
│                                                           │
│  3. Clip Transaction Service                              │
│                                                           │
│     a. Resolve paths                                      │
│        notePath = settings.defaultNoteFolder / pathHint   │
│        attachDir depends on strategy:                     │
│          - same-as-note: same folder as note              │
│          - subfolder: noteFolder / _assets / noteName     │
│          - global: settings.globalAttachmentFolder         │
│                                                           │
│     b. For each attachment (sequential or parallel):      │
│        i.  decode base64 → Uint8Array                     │
│        ii. if deduplicate: compute SHA-256, check vault   │
│            → if match: skip write, record "deduplicated"  │
│        iii. sanitize filename, resolve conflicts          │
│        iv. write binary to vault/attachDir/filename       │
│        v.  record AttachmentStatus (saved/failed/dedup'd) │
│                                                           │
│     c. Build URL-to-path mapping from linkMap + results   │
│                                                           │
│     d. Markdown Rewriter                                  │
│        for each linkMap entry with status "saved"/"dedup" │
│          replace original URL in markdown with:           │
│            wikilink mode:  ![[filename.ext]]              │
│            relative mode:  ![](./subfolder/filename.ext)  │
│        for each linkMap entry with status "failed"        │
│          keep original URL, add HTML comment <!-- failed  │
│                                                           │
│     e. Optionally prepend frontmatter                     │
│                                                           │
│     f. Write note file to vault                           │
│                                                           │
│     g. Build ResultReport                                 │
│        { status, notePath, attachments: AttachmentStatus, │
│          errors }                                         │
│                                                           │
│  4. Return ResultReport as HTTP 200 JSON                  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 5. Shared Manifest Schema

### 5.1 CapturePackage (extension → plugin)

```json
{
  "$comment": "Wire format v1.0 — extension to plugin",

  "version": "1.0",

  "source": {
    "url": "https://example.com/article/123",
    "title": "Article Title",
    "capturedAt": "2026-04-14T10:00:00Z"
  },

  "note": {
    "pathHint": "Clippings/2026-04-14 Article Title.md",
    "markdown": "# Article Title\n\nBody text with ![](https://example.com/img1.jpg) inline.\n"
  },

  "attachments": [
    {
      "id": "att_001",
      "originalUrl": "https://example.com/img1.jpg",
      "mimeType": "image/jpeg",
      "suggestedName": "img1.jpg",
      "dataBase64": "...(base64-encoded binary)...",
      "sha256": "a1b2c3d4..."
    }
  ],

  "linkMap": [
    {
      "from": "https://example.com/img1.jpg",
      "attachmentId": "att_001"
    }
  ],

  "options": {
    "rewriteMode": "wikilink",
    "deduplicate": true,
    "attachmentSubfolder": "_assets",
    "maxAttachmentBytes": 26214400
  }
}
```

**Field rules:**

| Field | Required | Notes |
|-------|----------|-------|
| `version` | yes | Semver minor. Currently `"1.0"`. Plugin rejects mismatched major version |
| `source.url` | yes | Original page URL. Redacted in logs to origin only |
| `source.title` | yes | Used for note filename and frontmatter |
| `source.capturedAt` | yes | ISO 8601 UTC |
| `note.pathHint` | yes | Suggested relative path within vault. Plugin may adjust |
| `note.markdown` | yes | Markdown content with original external image URLs still present |
| `attachments` | yes | Array, may be empty (markdown-only clip). Each has required `id`, `originalUrl`, `mimeType`, `suggestedName`, `dataBase64`. `sha256` optional but recommended |
| `linkMap` | yes | Maps each external URL that appears in markdown to an attachment ID. Allows the rewriter to know which URLs to replace |
| `options.rewriteMode` | yes | `"wikilink"` or `"relative-markdown"` |
| `options.deduplicate` | no | Default `true` |
| `options.attachmentSubfolder` | no | Overrides plugin setting for this clip |
| `options.maxAttachmentBytes` | no | Per-attachment size cap. Plugin rejects attachments exceeding this |

### 5.2 ResultReport (plugin → extension)

```json
{
  "$comment": "Wire format v1.0 — plugin to extension",

  "version": "1.0",

  "status": "partial",

  "notePath": "Clippings/2026-04-14 Article Title.md",

  "attachments": [
    { "id": "att_001", "status": "saved",       "vaultPath": "Clippings/_assets/img1.jpg" },
    { "id": "att_002", "status": "deduplicated", "vaultPath": "Clippings/_assets/shared-header.jpg" },
    { "id": "att_003", "status": "failed",       "code": "WRITE_FAILED", "message": "Disk write error" },
    { "id": "att_004", "status": "skipped" }
  ],

  "errors": [
    { "code": "WRITE_FAILED", "message": "Disk write error for att_003" }
  ]
}
```

**Status values:**

| Status | Meaning |
|--------|---------|
| `success` | All attachments processed without error |
| `partial` | Note saved, some attachments failed/skipped |
| `failed` | Note not saved, or all attachments failed AND policy is abort |

**Per-attachment status values:**

| Status | Meaning |
|--------|---------|
| `saved` | Written to vault successfully |
| `deduplicated` | Skipped write — existing file with same hash found |
| `failed` | Write failed (code + message provided) |
| `skipped` | Not processed (e.g., exceeded size limit, user deselected) |

### 5.3 Versioning Strategy

- Schema version is a two-part string: `"MAJOR.MINOR"` (e.g., `"1.0"`, `"1.1"`)
- **Major version bump**: Breaking changes. Plugin rejects packages with unsupported major version, returns `MANIFEST_VERSION_MISMATCH` error
- **Minor version bump**: Additive changes (new optional fields). Plugin must ignore unknown fields gracefully
- Both `CapturePackage.version` and `ResultReport.version` follow this scheme
- The shared-types package version in npm is independent of the schema version

---

## 6. Transport Protocol

### 6.1 Endpoint

```
POST http://localhost:{port}/v1/capture
```

### 6.2 Request

| Aspect | Value |
|--------|-------|
| Method | `POST` |
| Content-Type | `application/json` |
| Auth | `X-AuthClip-Token: <shared-secret>` header. Empty string means no auth required |
| Body | `CapturePackage` JSON. Binary payloads are base64-encoded strings inside `attachments[].dataBase64` |
| Max body size | 50 MB (configurable). Plugin returns `413 PAYLOAD_TOO_LARGE` if exceeded |

### 6.3 Response

| HTTP Status | Meaning | Body |
|-------------|---------|------|
| `200` | Processed (may be partial success) | `ResultReport` JSON |
| `400` | Validation failed | `ResultReport` with `status: "failed"`, `MANIFEST_INVALID` error |
| `401` | Auth token mismatch | `ResultReport` with `status: "failed"` |
| `413` | Payload too large | `ResultReport` with `PAYLOAD_TOO_LARGE` error |
| `500` | Unexpected server error | `ResultReport` with `status: "failed"` |

### 6.4 Alternative: Obsidian URI Fallback

If the HTTP server approach has issues (e.g., CORS in MV3, firewall), a fallback using `obsidian://authclip-capture` custom URI scheme is possible. The extension would encode the `CapturePackage` as a base64 query parameter. This is **not** the primary transport but should be architecturally feasible.

Decision: HTTP first, URI fallback for v2 if needed.

### 6.5 Connection Lifecycle

- Plugin starts the HTTP server on load, stops on unload
- Extension pings `GET /v1/health` to check plugin availability before showing the "Clip with local assets" button
- Extension caches plugin availability status, refreshes on popup open

---

## 7. Failure Model

### 7.1 Failure Domains

```
┌───────────────────────────────────────────────────────┐
│ EXTENSION SIDE                                        │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ Discovery    │  │ Fetch        │  │ Transport     │ │
│  │ failures     │  │ failures     │  │ failures      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘ │
│         │                │                 │          │
│         ▼                ▼                 ▼          │
│    DISCOVERY_       FETCH_FAILED      PLUGIN_        │
│    FAILED           FETCH_FORBIDDEN   UNAVAILABLE    │
│                     FETCH_TIMEOUT                    │
│                     PAYLOAD_TOO_LARGE                │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│ PLUGIN SIDE                                           │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ Validation   │  │ Write        │  │ Rewrite       │ │
│  │ failures     │  │ failures     │  │ failures      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘ │
│         │                │                 │          │
│         ▼                ▼                 ▼          │
│    MANIFEST_        WRITE_FAILED      REWRITE_       │
│    INVALID                             FAILED        │
│    MANIFEST_                                         │
│    VERSION_MISMATCH                                  │
└───────────────────────────────────────────────────────┘
```

### 7.2 Failure Matrix

| Stage | Error Code | Extension behavior | Plugin behavior | Note saved? |
|-------|-----------|-------------------|-----------------|-------------|
| **Discovery** — DOM parsing fails | `DISCOVERY_FAILED` | Show error in popup, abort clip | N/A | No |
| **Discovery** — no assets found | — | Proceed as normal clip (0 attachments) | Receive package with empty `attachments[]` | Yes |
| **Fetch** — single asset fails | `FETCH_FAILED` | Mark asset failed, continue fetching others | Never receives this asset | Yes |
| **Fetch** — single asset 403 | `FETCH_FORBIDDEN` | Mark asset failed, continue | Never receives this asset | Yes |
| **Fetch** — single asset timeout | `FETCH_TIMEOUT` | Mark asset failed, continue | Never receives this asset | Yes |
| **Fetch** — asset exceeds max size | `PAYLOAD_TOO_LARGE` | Exclude from package, show warning in preview | Never receives this asset | Yes |
| **Fetch** — ALL assets fail | Multiple `FETCH_*` | Send note with 0 attachments | Write note, report `partial` with 0 saved | Yes |
| **Transport** — plugin unreachable | `PLUGIN_UNAVAILABLE` | Show retry UI + "Copy markdown to clipboard" fallback | N/A | No |
| **Transport** — auth rejected | `PLUGIN_UNAVAILABLE` | Show auth error, prompt to check token | N/A | No |
| **Transport** — 413 payload | `PAYLOAD_TOO_LARGE` | Show "reduce attachments" UI, let user deselect | N/A | No |
| **Validation** — bad schema | `MANIFEST_INVALID` | Show validation error | Return 400 | No |
| **Validation** — version mismatch | `MANIFEST_VERSION_MISMATCH` | Show "update required" message | Return 400 | No |
| **Write** — single file fails | `WRITE_FAILED` | Shown in result report | Skip file, continue others, report `partial` | Yes |
| **Write** — name conflict | Handled by conflict strategy | N/A | `rename`: auto-rename. `overwrite`: replace. `deduplicate`: hash check first | Yes |
| **Rewrite** — URL not found in linkMap | `REWRITE_FAILED` | Shown as warning | Keep original URL in markdown, add HTML comment `<!-- authclip: failed to localize URL -->` | Yes |
| **Rewrite** — attachment was failed/skipped | — | N/A | Do NOT rewrite that URL — keep external link | Yes |

### 7.3 Guiding Principle

> **The note is always saved if at least the markdown was extracted.** Asset failures downgrade the result to `partial` but never prevent the note from being written. The only exception is when `failurePolicy` is set to `"abort-on-any-error"` AND an asset fails (user's explicit choice).

### 7.4 Error Propagation

```
Extension fetches 10 assets:
  ✓ 7 succeed → included in CapturePackage.attachments
  ✗ 3 fail    → NOT included in CapturePackage.attachments
                  recorded locally for UI display
                  included in CapturePackage as "fetchFailures" (v1.1 consideration)

Plugin receives 7 attachments:
  ✓ 5 write successfully   → AttachmentStatus { status: "saved" }
  ⟳ 1 is duplicate         → AttachmentStatus { status: "deduplicated" }
  ✗ 1 write fails          → AttachmentStatus { status: "failed", code: "WRITE_FAILED" }

Extension displays result:
  "Note saved: Clippings/2026-04-14 Article.md
   5 images saved locally
   1 image reused (duplicate)
   4 images could not be saved
     • img3.jpg — download failed
     • img7.jpg — access denied
     • img9.jpg — download timed out
     • img6.jpg — vault write error"
```

---

## 8. Security Model

### 8.1 Threat Mitigations

| Threat | Mitigation |
|--------|-----------|
| **Auth data in logs** | Dedicated `redact()` function strips cookies, `Authorization` headers, query params containing `token/key/secret/session/id` from all log output. Applied at the logging layer, not ad-hoc |
| **Path traversal** | `sanitizeFilename()` strips `..`, `/`, `\`, null bytes. Plugin rejects any resolved path outside the vault root |
| **XSS via markdown** | Content extractor sanitizes HTML before converting to markdown. No raw `<script>` or `<iframe>` passes through |
| **Token leakage in transport** | Auth token transmitted only over localhost. Never stored in markdown, frontmatter, or vault files. Not included in error reports |
| **Oversized payload** | Both sides enforce `maxAttachmentBytes`. Plugin enforces max total body size |
| **Malicious filenames** | Filenames sanitized before any filesystem operation. Generated names are alphanumeric + dashes |
| **Sensitive URLs in frontmatter** | `source.url` stored only if `keepSourceUrlInFrontmatter` is explicitly enabled. Query params stripped |

### 8.2 Data Boundary

```
All data stays on localhost.

Browser Extension        Obsidian Plugin
     │                        │
     │  localhost HTTP only    │
     │──────────────────────▶ │
     │                        │
     │  No cloud relay        │
     │  No third-party server │
     │  No telemetry          │
     │  No analytics          │
     │                        │
     ▼                        ▼
   User's browser         User's vault
```

---

## 9. MVP Scope

### What is in MVP (Phase 1)

| # | Feature | Side |
|---|---------|------|
| 1 | `@authclip/shared-types` package with all types, zod schemas, `sanitizeFilename`, `DEFAULT_SETTINGS` | Shared |
| 2 | "Clip with local assets" button in extension popup | Extension |
| 3 | Asset discovery: `img[src]`, `img[srcset]`, `picture source[srcset]` | Extension |
| 4 | Asset fetcher: download in browser context, base64 encode, per-asset error handling | Extension |
| 5 | Manifest builder: assemble `CapturePackage` | Extension |
| 6 | Transport client: HTTP POST to plugin | Extension |
| 7 | Plugin availability check (`GET /v1/health`) | Extension |
| 8 | HTTP receiver on localhost with auth middleware | Plugin |
| 9 | Manifest validation with zod | Plugin |
| 10 | Attachment writer: save to vault, rename on conflict | Plugin |
| 11 | Markdown rewriter: replace URLs with wikilinks `![[file.ext]]` | Plugin |
| 12 | Note writer: save `.md` file to vault | Plugin |
| 13 | Result report: per-attachment status returned to extension | Plugin |
| 14 | Partial success: note saved even if some attachments fail | Both |
| 15 | Frontmatter with `source_url`, `captured_at`, `clipper_mode`, `assets_saved`, `assets_failed` | Plugin |
| 16 | Basic settings tab (port, auth token, note folder, attachment folder strategy, rewrite mode) | Plugin |
| 17 | Log redaction: no tokens/cookies/auth headers in any log output | Both |
| 18 | Unit tests: schema validation, filename sanitization, markdown rewriting, manifest building | Shared + Both |

### What is explicitly deferred (Phase 2+)

| Feature | Phase | Reason |
|---------|-------|--------|
| CSS `background-image` discovery | Phase 2 | Lower priority, more complex DOM scanning |
| SHA-256 deduplication | Phase 2 | Requires hash computation + vault scanning |
| Preview/selection UI for attachments | Phase 2 | UI complexity |
| Conflict strategy: overwrite/deduplicate | Phase 2 | Rename is sufficient for MVP |
| Retry mechanism for failed downloads | Phase 2 | Complexity |
| Lazy-load / intersection observer heuristics | Phase 3 | Site-specific, needs testing |
| Obsidian URI fallback transport | Phase 2 | Only if HTTP has issues |
| Chunked/multipart transport | Phase 3 | Only if 50 MB limit is insufficient |
| Batch clipping queue | Phase 3 | Advanced UX |
| Site-specific adapters | Phase 3 | Requires per-site testing |
| `relative-markdown` rewrite mode | Phase 2 | Wikilink is sufficient for MVP |

---

## 10. Out of Scope for MVP

- Video, audio, streaming media
- Full site crawling / archival
- OCR, PDF rendering
- Cloud backend, user accounts, sync
- Mobile support
- DRM/CAPTCHA/anti-bot bypass
- Auto re-login
- Post-clip sync with source

---

## 11. Key Architectural Decisions

### ADR-001: HTTP localhost as primary transport

**Context:** Extension needs to send data to the Obsidian plugin. Options: (1) localhost HTTP, (2) Obsidian URI scheme, (3) WebSocket, (4) Native messaging.

**Decision:** HTTP localhost (`POST /v1/capture`).

**Rationale:**
- Simple request/response model matches our use case
- Obsidian plugin can start an HTTP server via Node.js `http` module (available in Electron)
- No browser-specific API limitations
- Easy to debug with curl/Postman
- Auth via simple header

**Consequences:**
- Port conflict risk (mitigated by configurable port)
- May need firewall exception on some systems
- Fallback to URI scheme available if needed

### ADR-002: Base64 encoding inside JSON (not multipart)

**Context:** Binary attachments need to be transmitted in the HTTP body.

**Decision:** Base64-encode binary data and embed inside JSON `attachments[].dataBase64`.

**Rationale:**
- Simpler parsing — single JSON payload, no multipart decoder needed
- Matches how Obsidian's existing URI API works
- Easier to validate entire payload as a unit with zod
- ~33% size overhead is acceptable for MVP (25 MB effective → ~33 MB on wire, well within localhost bandwidth)

**Consequences:**
- Size overhead, but localhost bandwidth is not a bottleneck
- Future chunked transport will use the same format per chunk

### ADR-003: Shared npm workspace package for types

**Context:** Extension and plugin need to agree on wire format.

**Decision:** `@authclip/shared-types` as a pnpm workspace package, imported by both apps.

**Rationale:**
- Single source of truth for the protocol
- TypeScript compiler enforces compatibility at build time
- Zod schemas provide runtime validation
- No npm publishing needed (workspace resolution)

**Consequences:**
- Both apps must be in the same monorepo (already the plan)
- Changes to shared types require rebuilding both apps

### ADR-004: Partial success as default behavior

**Context:** Assets can fail individually without compromising the clip.

**Decision:** Note is always saved if markdown extraction succeeded. Failed assets are reported but do not block the note.

**Rationale:**
- User explicitly stated preference (PRD §9, §FR-09)
- Losing the entire note because one image failed is a poor experience
- The note has independent value even without some images

**Consequences:**
- Plugin must be careful to write note last (after all attachment attempts)
- UI must clearly communicate partial results

### ADR-005: Sequential processing with future parallelism

**Context:** Attachments can be written to vault in parallel or sequence.

**Decision:** MVP uses sequential processing. Architecture allows future parallelism.

**Rationale:**
- Sequential is simpler, easier to debug, easier to test
- Vault filesystem operations are fast (local SSD)
- Parallelism can be added later as an optimization without changing the interface

**Consequences:**
- Slower for large batches (acceptable for MVP: ≤20 images)
- No race conditions to manage in MVP

---

## 12. Open Questions

| # | Question | Options | Default |
|---|----------|---------|---------|
| 1 | What port should the HTTP server default to? | Any unused port above 1024 | `27124` (unlikely to conflict) |
| 2 | Should extension use `chrome.scripting.executeScript` or content script for DOM access? | MV3 supports both; content script is simpler for persistent access | Content script |
| 3 | Should `fetch()` in the asset fetcher use `credentials: "include"` or rely on extension's host permissions? | `"include"` for page-context fetch, host permissions for background fetch | Page-context `fetch` with `"include"` |
| 4 | How to handle `blob:` and `data:` URIs discovered in the DOM? | `blob:` → fetch as normal. `data:` → parse inline, no network request needed | Support both |
| 5 | Should the plugin validate SHA-256 hashes provided by the extension, or compute its own? | Compute its own for trust. Extension-provided hash is informational only | Plugin computes its own |
| 6 | Max payload size for MVP? | 25 MB, 50 MB, 100 MB | 50 MB total (configurable) |
| 7 | Should the extension support clipping without the plugin installed? | Copy markdown + list of image URLs to clipboard as fallback | Yes, as fallback |
