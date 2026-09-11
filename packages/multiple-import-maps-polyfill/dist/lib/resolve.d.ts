export interface ImportMap {
    imports: Record<string, string | null>;
    scopes: Record<string, Record<string, string | null>>;
    integrity: Record<string, string>;
}
export interface ImportMapJson {
    imports?: Record<string, unknown>;
    scopes?: Record<string, Record<string, unknown>>;
    integrity?: Record<string, string>;
}
export declare const asURL: (url: string) => string | undefined;
export declare const resolveUrl: (relUrl: string, parentUrl: string) => string;
export declare const resolveIfNotPlainOrUrl: (relUrl: string, parentUrl: string) => string | undefined;
export declare const resolveAndComposeImportMap: (json: ImportMapJson, baseUrl: string, parentMap: ImportMap) => ImportMap;
export declare const resolveImportMap: (importMap: ImportMap, resolvedOrPlain: string, parentUrl: string) => string | false | undefined;
//# sourceMappingURL=resolve.d.ts.map