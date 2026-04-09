export declare function hashBytes(bytes: BufferSource): Promise<string>;
export declare function hashContent(content: string): Promise<string>;
export declare function generateFingerprint(options: {
    buildId: string;
    content: string | Uint8Array;
}): Promise<string>;
export declare function parseFingerprintSuffix(pathname: string): {
    pathname: string;
    requestedFingerprint: string | null;
};
export declare function parseHrefFingerprint(href: string): string | null;
export declare function formatFingerprintedPathname(pathname: string, fingerprint: string | null): string;
export declare function getFingerprintRequestCacheControl(requestedFingerprint: string | null): string;
//# sourceMappingURL=fingerprint.d.ts.map