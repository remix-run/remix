export declare function hashContent(content: string | Uint8Array<ArrayBufferLike>): Promise<string>;
export declare function generateFingerprint(args: {
    buildId: string;
    content: string | Uint8Array<ArrayBufferLike>;
}): Promise<string>;
export declare function parseFingerprintSuffix(pathname: string): {
    pathname: string;
    requestedFingerprint: string | null;
};
export declare function formatFingerprintedPathname(pathname: string, fingerprint: string | null): string;
export declare function getFingerprintRequestCacheControl(requestedFingerprint: string | null): string;
//# sourceMappingURL=fingerprint.d.ts.map