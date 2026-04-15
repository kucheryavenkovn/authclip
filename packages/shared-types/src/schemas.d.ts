import { z } from "zod";
export declare const ClipErrorCodeSchema: z.ZodEnum<["DISCOVERY_FAILED", "FETCH_FAILED", "FETCH_FORBIDDEN", "FETCH_TIMEOUT", "PAYLOAD_TOO_LARGE", "PLUGIN_UNAVAILABLE", "WRITE_FAILED", "REWRITE_FAILED", "MANIFEST_INVALID", "MANIFEST_VERSION_MISMATCH"]>;
export declare const AssetSourceSchema: z.ZodEnum<["img-src", "img-srcset", "picture-srcset", "css-bg"]>;
export declare const DiscoveredAssetSchema: z.ZodObject<{
    id: z.ZodString;
    url: z.ZodString;
    source: z.ZodEnum<["img-src", "img-srcset", "picture-srcset", "css-bg"]>;
    mimeType: z.ZodOptional<z.ZodString>;
    sizeBytes: z.ZodOptional<z.ZodNumber>;
    selected: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    url: string;
    source: "img-src" | "img-srcset" | "picture-srcset" | "css-bg";
    selected: boolean;
    mimeType?: string | undefined;
    sizeBytes?: number | undefined;
}, {
    id: string;
    url: string;
    source: "img-src" | "img-srcset" | "picture-srcset" | "css-bg";
    selected: boolean;
    mimeType?: string | undefined;
    sizeBytes?: number | undefined;
}>;
export declare const AttachmentPayloadSchema: z.ZodObject<{
    id: z.ZodString;
    originalUrl: z.ZodString;
    mimeType: z.ZodString;
    suggestedName: z.ZodString;
    dataBase64: z.ZodString;
    sha256: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    mimeType: string;
    originalUrl: string;
    suggestedName: string;
    dataBase64: string;
    sha256?: string | undefined;
}, {
    id: string;
    mimeType: string;
    originalUrl: string;
    suggestedName: string;
    dataBase64: string;
    sha256?: string | undefined;
}>;
export declare const LinkMapEntrySchema: z.ZodObject<{
    from: z.ZodString;
    attachmentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    attachmentId: string;
}, {
    from: string;
    attachmentId: string;
}>;
export declare const RewriteModeSchema: z.ZodEnum<["wikilink", "relative-markdown"]>;
export declare const CaptureSourceSchema: z.ZodObject<{
    url: z.ZodString;
    title: z.ZodString;
    capturedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
    title: string;
    capturedAt: string;
}, {
    url: string;
    title: string;
    capturedAt: string;
}>;
export declare const CaptureNoteSchema: z.ZodObject<{
    pathHint: z.ZodString;
    markdown: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pathHint: string;
    markdown: string;
}, {
    pathHint: string;
    markdown: string;
}>;
export declare const CaptureOptionsSchema: z.ZodObject<{
    rewriteMode: z.ZodEnum<["wikilink", "relative-markdown"]>;
    deduplicate: z.ZodBoolean;
    attachmentSubfolder: z.ZodOptional<z.ZodString>;
    maxAttachmentBytes: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    deduplicate: boolean;
    rewriteMode: "wikilink" | "relative-markdown";
    maxAttachmentBytes?: number | undefined;
    attachmentSubfolder?: string | undefined;
}, {
    deduplicate: boolean;
    rewriteMode: "wikilink" | "relative-markdown";
    maxAttachmentBytes?: number | undefined;
    attachmentSubfolder?: string | undefined;
}>;
export declare const CaptureMetaSchema: z.ZodObject<{
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    published: z.ZodOptional<z.ZodString>;
    siteName: z.ZodOptional<z.ZodString>;
    domain: z.ZodOptional<z.ZodString>;
    favicon: z.ZodOptional<z.ZodString>;
    image: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
    wordCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    author?: string | undefined;
    description?: string | undefined;
    published?: string | undefined;
    siteName?: string | undefined;
    domain?: string | undefined;
    favicon?: string | undefined;
    image?: string | undefined;
    language?: string | undefined;
    wordCount?: number | undefined;
}, {
    author?: string | undefined;
    description?: string | undefined;
    published?: string | undefined;
    siteName?: string | undefined;
    domain?: string | undefined;
    favicon?: string | undefined;
    image?: string | undefined;
    language?: string | undefined;
    wordCount?: number | undefined;
}>;
export declare const CapturePackageSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0">;
    source: z.ZodObject<{
        url: z.ZodString;
        title: z.ZodString;
        capturedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        title: string;
        capturedAt: string;
    }, {
        url: string;
        title: string;
        capturedAt: string;
    }>;
    note: z.ZodObject<{
        pathHint: z.ZodString;
        markdown: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pathHint: string;
        markdown: string;
    }, {
        pathHint: string;
        markdown: string;
    }>;
    attachments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        originalUrl: z.ZodString;
        mimeType: z.ZodString;
        suggestedName: z.ZodString;
        dataBase64: z.ZodString;
        sha256: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        mimeType: string;
        originalUrl: string;
        suggestedName: string;
        dataBase64: string;
        sha256?: string | undefined;
    }, {
        id: string;
        mimeType: string;
        originalUrl: string;
        suggestedName: string;
        dataBase64: string;
        sha256?: string | undefined;
    }>, "many">;
    linkMap: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        attachmentId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        from: string;
        attachmentId: string;
    }, {
        from: string;
        attachmentId: string;
    }>, "many">;
    options: z.ZodObject<{
        rewriteMode: z.ZodEnum<["wikilink", "relative-markdown"]>;
        deduplicate: z.ZodBoolean;
        attachmentSubfolder: z.ZodOptional<z.ZodString>;
        maxAttachmentBytes: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        deduplicate: boolean;
        rewriteMode: "wikilink" | "relative-markdown";
        maxAttachmentBytes?: number | undefined;
        attachmentSubfolder?: string | undefined;
    }, {
        deduplicate: boolean;
        rewriteMode: "wikilink" | "relative-markdown";
        maxAttachmentBytes?: number | undefined;
        attachmentSubfolder?: string | undefined;
    }>;
    meta: z.ZodOptional<z.ZodObject<{
        author: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        published: z.ZodOptional<z.ZodString>;
        siteName: z.ZodOptional<z.ZodString>;
        domain: z.ZodOptional<z.ZodString>;
        favicon: z.ZodOptional<z.ZodString>;
        image: z.ZodOptional<z.ZodString>;
        language: z.ZodOptional<z.ZodString>;
        wordCount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        author?: string | undefined;
        description?: string | undefined;
        published?: string | undefined;
        siteName?: string | undefined;
        domain?: string | undefined;
        favicon?: string | undefined;
        image?: string | undefined;
        language?: string | undefined;
        wordCount?: number | undefined;
    }, {
        author?: string | undefined;
        description?: string | undefined;
        published?: string | undefined;
        siteName?: string | undefined;
        domain?: string | undefined;
        favicon?: string | undefined;
        image?: string | undefined;
        language?: string | undefined;
        wordCount?: number | undefined;
    }>>;
    selectedHtml: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    attachments: {
        id: string;
        mimeType: string;
        originalUrl: string;
        suggestedName: string;
        dataBase64: string;
        sha256?: string | undefined;
    }[];
    source: {
        url: string;
        title: string;
        capturedAt: string;
    };
    options: {
        deduplicate: boolean;
        rewriteMode: "wikilink" | "relative-markdown";
        maxAttachmentBytes?: number | undefined;
        attachmentSubfolder?: string | undefined;
    };
    version: "1.0";
    note: {
        pathHint: string;
        markdown: string;
    };
    linkMap: {
        from: string;
        attachmentId: string;
    }[];
    meta?: {
        author?: string | undefined;
        description?: string | undefined;
        published?: string | undefined;
        siteName?: string | undefined;
        domain?: string | undefined;
        favicon?: string | undefined;
        image?: string | undefined;
        language?: string | undefined;
        wordCount?: number | undefined;
    } | undefined;
    selectedHtml?: string | undefined;
}, {
    attachments: {
        id: string;
        mimeType: string;
        originalUrl: string;
        suggestedName: string;
        dataBase64: string;
        sha256?: string | undefined;
    }[];
    source: {
        url: string;
        title: string;
        capturedAt: string;
    };
    options: {
        deduplicate: boolean;
        rewriteMode: "wikilink" | "relative-markdown";
        maxAttachmentBytes?: number | undefined;
        attachmentSubfolder?: string | undefined;
    };
    version: "1.0";
    note: {
        pathHint: string;
        markdown: string;
    };
    linkMap: {
        from: string;
        attachmentId: string;
    }[];
    meta?: {
        author?: string | undefined;
        description?: string | undefined;
        published?: string | undefined;
        siteName?: string | undefined;
        domain?: string | undefined;
        favicon?: string | undefined;
        image?: string | undefined;
        language?: string | undefined;
        wordCount?: number | undefined;
    } | undefined;
    selectedHtml?: string | undefined;
}>;
export declare const AttachmentStatusSavedSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodLiteral<"saved">;
    vaultPath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "saved";
    vaultPath: string;
}, {
    id: string;
    status: "saved";
    vaultPath: string;
}>;
export declare const AttachmentStatusDeduplicatedSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodLiteral<"deduplicated">;
    vaultPath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "deduplicated";
    vaultPath: string;
}, {
    id: string;
    status: "deduplicated";
    vaultPath: string;
}>;
export declare const AttachmentStatusFailedSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodLiteral<"failed">;
    code: z.ZodEnum<["DISCOVERY_FAILED", "FETCH_FAILED", "FETCH_FORBIDDEN", "FETCH_TIMEOUT", "PAYLOAD_TOO_LARGE", "PLUGIN_UNAVAILABLE", "WRITE_FAILED", "REWRITE_FAILED", "MANIFEST_INVALID", "MANIFEST_VERSION_MISMATCH"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
    message: string;
    status: "failed";
}, {
    id: string;
    code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
    message: string;
    status: "failed";
}>;
export declare const AttachmentStatusSkippedSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodLiteral<"skipped">;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "skipped";
}, {
    id: string;
    status: "skipped";
}>;
export declare const AttachmentStatusSchema: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    id: z.ZodString;
    status: z.ZodLiteral<"saved">;
    vaultPath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "saved";
    vaultPath: string;
}, {
    id: string;
    status: "saved";
    vaultPath: string;
}>, z.ZodObject<{
    id: z.ZodString;
    status: z.ZodLiteral<"deduplicated">;
    vaultPath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "deduplicated";
    vaultPath: string;
}, {
    id: string;
    status: "deduplicated";
    vaultPath: string;
}>, z.ZodObject<{
    id: z.ZodString;
    status: z.ZodLiteral<"failed">;
    code: z.ZodEnum<["DISCOVERY_FAILED", "FETCH_FAILED", "FETCH_FORBIDDEN", "FETCH_TIMEOUT", "PAYLOAD_TOO_LARGE", "PLUGIN_UNAVAILABLE", "WRITE_FAILED", "REWRITE_FAILED", "MANIFEST_INVALID", "MANIFEST_VERSION_MISMATCH"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
    message: string;
    status: "failed";
}, {
    id: string;
    code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
    message: string;
    status: "failed";
}>, z.ZodObject<{
    id: z.ZodString;
    status: z.ZodLiteral<"skipped">;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "skipped";
}, {
    id: string;
    status: "skipped";
}>]>;
export declare const ClipResultStatusSchema: z.ZodEnum<["success", "partial", "failed"]>;
export declare const ResultReportErrorSchema: z.ZodObject<{
    code: z.ZodEnum<["DISCOVERY_FAILED", "FETCH_FAILED", "FETCH_FORBIDDEN", "FETCH_TIMEOUT", "PAYLOAD_TOO_LARGE", "PLUGIN_UNAVAILABLE", "WRITE_FAILED", "REWRITE_FAILED", "MANIFEST_INVALID", "MANIFEST_VERSION_MISMATCH"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
    message: string;
}, {
    code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
    message: string;
}>;
export declare const ResultReportSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0">;
    status: z.ZodEnum<["success", "partial", "failed"]>;
    notePath: z.ZodNullable<z.ZodString>;
    attachments: z.ZodArray<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
        id: z.ZodString;
        status: z.ZodLiteral<"saved">;
        vaultPath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "saved";
        vaultPath: string;
    }, {
        id: string;
        status: "saved";
        vaultPath: string;
    }>, z.ZodObject<{
        id: z.ZodString;
        status: z.ZodLiteral<"deduplicated">;
        vaultPath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "deduplicated";
        vaultPath: string;
    }, {
        id: string;
        status: "deduplicated";
        vaultPath: string;
    }>, z.ZodObject<{
        id: z.ZodString;
        status: z.ZodLiteral<"failed">;
        code: z.ZodEnum<["DISCOVERY_FAILED", "FETCH_FAILED", "FETCH_FORBIDDEN", "FETCH_TIMEOUT", "PAYLOAD_TOO_LARGE", "PLUGIN_UNAVAILABLE", "WRITE_FAILED", "REWRITE_FAILED", "MANIFEST_INVALID", "MANIFEST_VERSION_MISMATCH"]>;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
        message: string;
        status: "failed";
    }, {
        id: string;
        code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
        message: string;
        status: "failed";
    }>, z.ZodObject<{
        id: z.ZodString;
        status: z.ZodLiteral<"skipped">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "skipped";
    }, {
        id: string;
        status: "skipped";
    }>]>, "many">;
    errors: z.ZodArray<z.ZodObject<{
        code: z.ZodEnum<["DISCOVERY_FAILED", "FETCH_FAILED", "FETCH_FORBIDDEN", "FETCH_TIMEOUT", "PAYLOAD_TOO_LARGE", "PLUGIN_UNAVAILABLE", "WRITE_FAILED", "REWRITE_FAILED", "MANIFEST_INVALID", "MANIFEST_VERSION_MISMATCH"]>;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
        message: string;
    }, {
        code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
        message: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    attachments: ({
        id: string;
        status: "saved";
        vaultPath: string;
    } | {
        id: string;
        status: "deduplicated";
        vaultPath: string;
    } | {
        id: string;
        code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
        message: string;
        status: "failed";
    } | {
        id: string;
        status: "skipped";
    })[];
    status: "success" | "partial" | "failed";
    version: "1.0";
    notePath: string | null;
    errors: {
        code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
        message: string;
    }[];
}, {
    attachments: ({
        id: string;
        status: "saved";
        vaultPath: string;
    } | {
        id: string;
        status: "deduplicated";
        vaultPath: string;
    } | {
        id: string;
        code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
        message: string;
        status: "failed";
    } | {
        id: string;
        status: "skipped";
    })[];
    status: "success" | "partial" | "failed";
    version: "1.0";
    notePath: string | null;
    errors: {
        code: "DISCOVERY_FAILED" | "FETCH_FAILED" | "FETCH_FORBIDDEN" | "FETCH_TIMEOUT" | "PAYLOAD_TOO_LARGE" | "PLUGIN_UNAVAILABLE" | "WRITE_FAILED" | "REWRITE_FAILED" | "MANIFEST_INVALID" | "MANIFEST_VERSION_MISMATCH";
        message: string;
    }[];
}>;
//# sourceMappingURL=schemas.d.ts.map