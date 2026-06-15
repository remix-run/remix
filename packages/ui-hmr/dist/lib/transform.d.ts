export interface ComponentHmrTransformResult {
    code: string;
    componentNames: string[];
    map: string | null;
    transformed: boolean;
}
export declare function transformComponentHmr(source: string, options: {
    moduleUrl: string;
    refreshSpecifier?: string;
    runtimeSpecifier?: string;
    sourceMap?: boolean;
}): ComponentHmrTransformResult;
//# sourceMappingURL=transform.d.ts.map