import { describe, it, expect } from "vitest";
import { ResultReportSchema } from "../src/schemas";
import { buildResultStatus } from "../src/result-report";
import type { ResultReport } from "../src/result-report";
import type { AttachmentStatus } from "../src/attachment";

function makeValidReport(
  overrides?: Partial<ResultReport>
): ResultReport {
  return {
    version: "1.0",
    status: "success",
    notePath: "Clippings/test.md",
    attachments: [
      { id: "att_001", status: "saved", vaultPath: "Clippings/_assets/img1.jpg" },
    ],
    errors: [],
    ...overrides,
  };
}

describe("ResultReportSchema", () => {
  it("accepts a valid success report", () => {
    const report = makeValidReport();
    const result = ResultReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("accepts a partial report", () => {
    const report = makeValidReport({
      status: "partial",
      attachments: [
        { id: "att_001", status: "saved", vaultPath: "Clippings/_assets/img1.jpg" },
        {
          id: "att_002",
          status: "failed",
          code: "WRITE_FAILED",
          message: "Disk error",
        },
      ],
      errors: [{ code: "WRITE_FAILED", message: "Disk error for att_002" }],
    });
    const result = ResultReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("accepts a failed report with null notePath", () => {
    const report = makeValidReport({
      status: "failed",
      notePath: null,
      attachments: [],
      errors: [{ code: "MANIFEST_INVALID", message: "Bad schema" }],
    });
    const result = ResultReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("accepts deduplicated attachment status", () => {
    const report = makeValidReport({
      attachments: [
        {
          id: "att_001",
          status: "deduplicated",
          vaultPath: "Clippings/_assets/shared.jpg",
        },
      ],
    });
    const result = ResultReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("accepts skipped attachment status", () => {
    const report = makeValidReport({
      status: "partial",
      attachments: [
        { id: "att_001", status: "saved", vaultPath: "a.jpg" },
        { id: "att_002", status: "skipped" },
      ],
    });
    const result = ResultReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("rejects invalid status value", () => {
    const report = makeValidReport({ status: "unknown" as "success" });
    const result = ResultReportSchema.safeParse(report);
    expect(result.success).toBe(false);
  });

  it("rejects attachment with unknown status variant", () => {
    const report = makeValidReport({
      attachments: [
        { id: "att_001", status: "pending" } as unknown as AttachmentStatus,
      ],
    });
    const result = ResultReportSchema.safeParse(report);
    expect(result.success).toBe(false);
  });

  it("rejects saved status without vaultPath", () => {
    const report = makeValidReport({
      attachments: [
        { id: "att_001", status: "saved" } as unknown as AttachmentStatus,
      ],
    });
    const result = ResultReportSchema.safeParse(report);
    expect(result.success).toBe(false);
  });

  it("rejects failed status without code", () => {
    const report = makeValidReport({
      status: "partial",
      attachments: [
        {
          id: "att_001",
          status: "failed",
          message: "error",
        } as unknown as AttachmentStatus,
      ],
    });
    const result = ResultReportSchema.safeParse(report);
    expect(result.success).toBe(false);
  });
});

describe("buildResultStatus", () => {
  it("returns success when all attachments saved", () => {
    const attachments: AttachmentStatus[] = [
      { id: "1", status: "saved", vaultPath: "a.jpg" },
      { id: "2", status: "deduplicated", vaultPath: "b.jpg" },
    ];
    expect(buildResultStatus(attachments, true)).toBe("success");
  });

  it("returns partial when some attachments failed", () => {
    const attachments: AttachmentStatus[] = [
      { id: "1", status: "saved", vaultPath: "a.jpg" },
      { id: "2", status: "failed", code: "WRITE_FAILED", message: "err" },
    ];
    expect(buildResultStatus(attachments, true)).toBe("partial");
  });

  it("returns partial when all attachments failed but note saved", () => {
    const attachments: AttachmentStatus[] = [
      { id: "1", status: "failed", code: "WRITE_FAILED", message: "err" },
    ];
    expect(buildResultStatus(attachments, true)).toBe("partial");
  });

  it("returns failed when note not saved", () => {
    const attachments: AttachmentStatus[] = [];
    expect(buildResultStatus(attachments, false)).toBe("failed");
  });

  it("returns success for empty attachments with note saved", () => {
    expect(buildResultStatus([], true)).toBe("success");
  });
});
