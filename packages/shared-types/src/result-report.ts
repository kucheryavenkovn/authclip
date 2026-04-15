// FILE: packages/shared-types/src/result-report.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Define result report types and status derivation logic
//   SCOPE: ClipResultStatus, ResultReportError, ResultReport, buildResultStatus
//   DEPENDS: errors.ts, attachment.ts
//   LINKS: M-SHARED-TYPES
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   ClipResultStatus - Overall outcome: success | partial | failed
//   ResultReportError - Error entry with code and message
//   ResultReport - Plugin-to-extension status report
//   buildResultStatus - Derive ClipResultStatus from attachment statuses
// END_MODULE_MAP

import type { ClipErrorCode } from "./errors";
import type { AttachmentStatus } from "./attachment";

export type ClipResultStatus = "success" | "partial" | "failed";

export interface ResultReportError {
  code: ClipErrorCode;
  message: string;
}

export interface ResultReport {
  version: "1.0";
  status: ClipResultStatus;
  notePath: string | null;
  attachments: AttachmentStatus[];
  errors: ResultReportError[];
}

export function buildResultStatus(
  attachments: AttachmentStatus[],
  noteSaved: boolean
): ClipResultStatus {
  if (!noteSaved) return "failed";

  const failedCount = attachments.filter((a) => a.status === "failed").length;
  if (failedCount === 0) return "success";
  return "partial";
}
