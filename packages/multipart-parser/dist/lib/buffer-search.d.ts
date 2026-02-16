export interface SearchFunction {
    (haystack: Uint8Array, start?: number): number;
}
export declare function createSearch(pattern: string): SearchFunction;
export interface PartialTailSearchFunction {
    (haystack: Uint8Array): number;
}
export declare function createPartialTailSearch(pattern: string): PartialTailSearchFunction;
//# sourceMappingURL=buffer-search.d.ts.map