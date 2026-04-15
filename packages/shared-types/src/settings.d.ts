import type { RewriteMode } from "./capture-package";
export interface ClipSettings {
    port: number;
    authToken: string;
    defaultNoteFolder: string;
    attachmentFolderStrategy: "same-as-note" | "subfolder" | "global";
    attachmentSubfolderName: string;
    globalAttachmentFolder: string;
    rewriteMode: RewriteMode;
    conflictStrategy: "rename" | "overwrite" | "deduplicate";
    failurePolicy: "save-note-anyway" | "abort-on-any-error";
    deduplicateByHash: boolean;
    maxAttachmentBytes: number;
    includeBackgroundImages: boolean;
    keepSourceUrlInFrontmatter: boolean;
}
export declare const DEFAULT_SETTINGS: Readonly<ClipSettings>;
//# sourceMappingURL=settings.d.ts.map