export type AssetSource = "img-src" | "img-srcset" | "picture-srcset" | "css-bg";
export interface DiscoveredAsset {
    id: string;
    url: string;
    source: AssetSource;
    mimeType?: string;
    sizeBytes?: number;
    selected: boolean;
}
export interface AttachmentPayload {
    id: string;
    originalUrl: string;
    mimeType: string;
    suggestedName: string;
    dataBase64: string;
    sha256?: string;
}
export type AttachmentResultStatus = "saved" | "deduplicated" | "failed" | "skipped";
export interface AttachmentStatusSaved {
    id: string;
    status: "saved";
    vaultPath: string;
}
export interface AttachmentStatusDeduplicated {
    id: string;
    status: "deduplicated";
    vaultPath: string;
}
export interface AttachmentStatusFailed {
    id: string;
    status: "failed";
    code: import("./errors").ClipErrorCode;
    message: string;
}
export interface AttachmentStatusSkipped {
    id: string;
    status: "skipped";
}
export type AttachmentStatus = AttachmentStatusSaved | AttachmentStatusDeduplicated | AttachmentStatusFailed | AttachmentStatusSkipped;
//# sourceMappingURL=attachment.d.ts.map