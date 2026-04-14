import type { DiscoveredAsset, AssetSource } from "@authclip/shared-types";

let idCounter = 0;

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

export function discoverAssets(root: ParentNode, baseUrl: string): DiscoveredAsset[] {
  resetIdCounter();
  const seen = new Set<string>();
  const assets: DiscoveredAsset[] = [];
  for (const collector of COLLECTORS) {
    collector(root, baseUrl, seen, assets);
  }
  return assets;
}
