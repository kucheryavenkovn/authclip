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
export declare function buildResultStatus(attachments: AttachmentStatus[], noteSaved: boolean): ClipResultStatus;
//# sourceMappingURL=result-report.d.ts.map