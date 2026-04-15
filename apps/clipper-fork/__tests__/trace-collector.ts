// FILE: apps/clipper-fork/__tests__/trace-collector.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Test utility for capturing and asserting on structured log entries during tests
//   SCOPE: Trace entry collection, block marker assertions, order assertions, redaction checks
//   DEPENDS: none
//   ROLE: TEST
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   TraceCollector - Captures structured log entries and provides assertion helpers
//   TraceEntry - Single captured log entry with marker, message, and optional fields
// END_MODULE_MAP

export interface TraceEntry {
  marker: string;
  message: string;
  index: number;
}

export class TraceCollector {
  private entries: TraceEntry[] = [];
  private nextIndex = 0;

  readonly log: (msg: string) => void;

  constructor() {
    this.log = (msg: string) => {
      const match = msg.match(/^\[([^\]]+)\]\[([^\]]+)\]\[([^\]]+)\]/);
      const marker = match ? `${match[1]}][${match[2]}][${match[3]}` : "";
      this.entries.push({
        marker,
        message: msg,
        index: this.nextIndex++,
      });
    };
  }

  get all(): ReadonlyArray<TraceEntry> {
    return this.entries;
  }

  get messages(): string[] {
    return this.entries.map((e) => e.message);
  }

  get markers(): string[] {
    return this.entries.map((e) => e.marker);
  }

  hasMarker(marker: string): boolean {
    return this.entries.some((e) => e.marker === marker);
  }

  hasMarkerContaining(partial: string): boolean {
    return this.entries.some((e) => e.marker.includes(partial) || e.message.includes(partial));
  }

  markerCount(marker: string): number {
    return this.entries.filter((e) => e.marker === marker).length;
  }

  markerIndex(marker: string): number {
    const entry = this.entries.find((e) => e.marker === marker);
    return entry ? entry.index : -1;
  }

  markerBefore(earlier: string, later: string): boolean {
    const earlyIdx = this.markerIndex(earlier);
    const lateIdx = this.markerIndex(later);
    if (earlyIdx === -1 || lateIdx === -1) return false;
    return earlyIdx < lateIdx;
  }

  assertMarker(marker: string): void {
    if (!this.hasMarker(marker)) {
      throw new Error(
        `Expected marker "${marker}" not found in trace.\nActual markers: ${JSON.stringify(this.markers)}`
      );
    }
  }

  assertNoMarker(marker: string): void {
    if (this.hasMarker(marker)) {
      const matching = this.entries.filter((e) => e.marker === marker);
      throw new Error(
        `Forbidden marker "${marker}" found in trace.\nMatching entries: ${JSON.stringify(matching.map((e) => e.message))}`
      );
    }
  }

  assertMarkerContaining(partial: string): void {
    if (!this.hasMarkerContaining(partial)) {
      throw new Error(
        `Expected partial "${partial}" not found in any trace entry.\nActual messages: ${JSON.stringify(this.messages)}`
      );
    }
  }

  assertNoMarkerContaining(partial: string): void {
    if (this.hasMarkerContaining(partial)) {
      const matching = this.entries.filter(
        (e) => e.marker.includes(partial) || e.message.includes(partial)
      );
      throw new Error(
        `Forbidden partial "${partial}" found in trace.\nMatching entries: ${JSON.stringify(matching.map((e) => e.message))}`
      );
    }
  }

  assertMarkerBefore(earlier: string, later: string): void {
    if (!this.markerBefore(earlier, later)) {
      throw new Error(
        `Expected marker "${earlier}" to appear before "${later}".\n` +
          `Indices: ${this.markerIndex(earlier)} vs ${this.markerIndex(later)}\n` +
          `Actual markers: ${JSON.stringify(this.markers)}`
      );
    }
  }

  assertMarkerCount(marker: string, expected: number): void {
    const actual = this.markerCount(marker);
    if (actual !== expected) {
      throw new Error(
        `Expected marker "${marker}" to appear ${expected} times, but found ${actual}.\nActual markers: ${JSON.stringify(this.markers)}`
      );
    }
  }

  assertNoSecrets(): void {
    const secretPatterns = [
      /X-AuthClip-Token:\s*\S+/i,
      /cookie:\s*\S+/i,
      /authorization:\s*\S+/i,
      /data:image\/[^;]+;base64,[A-Za-z0-9+/=]{20,}/,
      /token\s*[:=]\s*["\w]{8,}/i,
    ];
    for (const entry of this.entries) {
      for (const pattern of secretPatterns) {
        if (pattern.test(entry.message)) {
          throw new Error(
            `Secret pattern found in log entry: "${entry.message}"\nPattern: ${pattern.source}`
          );
        }
      }
    }
  }

  reset(): void {
    this.entries = [];
    this.nextIndex = 0;
  }
}
