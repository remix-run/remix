interface ScopedRequest {
    namespace: string;
    parentURL: string;
    specifier: string;
}
export declare function appendNamespaceToUrl(url: string, namespace: string): string;
export declare function createScopedSpecifier(request: ScopedRequest): string;
export declare function getNamespace(url: string | undefined): string | undefined;
export declare function parseScopedSpecifier(specifier: string): ScopedRequest | undefined;
export {};
//# sourceMappingURL=request.d.ts.map