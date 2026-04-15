// FILE: apps/clipper-fork/src/asset-discovery.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Discover image assets in page DOM (img, srcset, picture)
//   SCOPE: DOM traversal, URL deduplication, srcset parsing
//   DEPENDS: M-SHARED-TYPES (DiscoveredAsset, AssetSource)
//   LINKS: M-CLIPPER-FORK
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   parseSrcset - Parse srcset attribute string into URL array
//   resetIdCounter - Reset internal asset ID counter (for tests)
//   discoverAssets - Find all image assets in a DOM subtree
// END_MODULE_MAP

import type { DiscoveredAsset, AssetSource } from "@authclip/shared-types";

// START_CHANGE_SUMMARY
//   LAST_CHANGE: v0.2.0 - Initial GRACE markup added to existing implementation
// END_CHANGE_SUMMARY

let idCounter = 0;

// START_CONTRACT: nextId
//   PURPOSE: Generate sequential asset IDs
//   INPUTS: {}
//   OUTPUTS: { string - unique asset ID like "asset_N" }
//   SIDE_EFFECTS: Increments internal counter
//   LINKS: discoverAssets
// END_CONTRACT: nextId
function nextId(): string {
  return `asset_${++idCounter}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

const SRCSET_ITEM = /\s*(\S+)(?:\s+(\S+))?\s*,?/g;

export function parseSrcset(srcset: string): string[] {
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  SRCSET_ITEM.lastIndex = 0;
  while ((match = SRCSET_ITEM.exec(srcset)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

function resolveUrl(raw: string, base: string): string | null {
  try {
    return new URL(raw, base).href;
  } catch {
    return null;
  }
}

function collectFromImgSrc(root: ParentNode, base: string, seen: Set<string>, out: DiscoveredAsset[]): void {
  const imgs = root.querySelectorAll("img[src]");
  for (const img of imgs) {
    const raw = img.getAttribute("src");
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const url = resolveUrl(trimmed, base);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ id: nextId(), url, source: "img-src", selected: true });
  }
}

function collectFromImgSrcset(root: ParentNode, base: string, seen: Set<string>, out: DiscoveredAsset[]): void {
  const imgs = root.querySelectorAll("img[srcset]");
  for (const img of imgs) {
    const srcset = img.getAttribute("srcset");
    if (!srcset) continue;
    for (const raw of parseSrcset(srcset)) {
      const url = resolveUrl(raw, base);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ id: nextId(), url, source: "img-srcset", selected: true });
    }
  }
}

function collectFromPictureSrcset(root: ParentNode, base: string, seen: Set<string>, out: DiscoveredAsset[]): void {
  const sources = root.querySelectorAll("picture source[srcset]");
  for (const source of sources) {
    const srcset = source.getAttribute("srcset");
    if (!srcset) continue;
    for (const raw of parseSrcset(srcset)) {
      const url = resolveUrl(raw, base);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ id: nextId(), url, source: "picture-srcset", selected: true });
    }
  }
}

const COLLECTORS: Array<
  (root: ParentNode, base: string, seen: Set<string>, out: DiscoveredAsset[]) => void
> = [collectFromImgSrc, collectFromImgSrcset, collectFromPictureSrcset];

// START_CONTRACT: discoverAssets
//   PURPOSE: Discover all image assets in DOM subtree
//   INPUTS: { root: ParentNode - DOM root to search, baseUrl: string - base URL for resolution }
//   OUTPUTS: { DiscoveredAsset[] - deduplicated list of found assets }
//   SIDE_EFFECTS: Resets internal ID counter
//   LINKS: M-SHARED-TYPES, M-CLIPPER-FORK
// END_CONTRACT: discoverAssets
export function discoverAssets(root: ParentNode, baseUrl: string, log?: (msg: string) => void): DiscoveredAsset[] {
  // START_BLOCK_DISCOVER_ASSETS
  resetIdCounter();
  const seen = new Set<string>();
  const assets: DiscoveredAsset[] = [];
  for (const collector of COLLECTORS) {
    collector(root, baseUrl, seen, assets);
  }
  log?.(`[ClipperFork][discoverAssets][BLOCK_DISCOVER_ASSETS] discovered ${assets.length} assets`);
  return assets;
  // END_BLOCK_DISCOVER_ASSETS
}
