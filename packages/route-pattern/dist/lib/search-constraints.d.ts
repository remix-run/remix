export type SearchConstraints = Map<string, {
    requiredValues?: Set<string>;
    requireAssignment: boolean;
    allowBare: boolean;
}>;
export declare function parseSearchConstraints(search: string): SearchConstraints;
export declare function parseSearch(search: string): {
    namesWithoutAssignment: Set<string>;
    namesWithAssignment: Set<string>;
    valuesByKey: Map<string, Set<string>>;
};
//# sourceMappingURL=search-constraints.d.ts.map