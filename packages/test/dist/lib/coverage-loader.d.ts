export declare function load(url: string, context: {
    format?: string;
}, nextLoad: (url: string, context: {
    format?: string;
}) => Promise<{
    format: string;
    source: string;
}>): Promise<{
    format: string;
    source: string;
} | {
    format: string;
    source: string;
    shortCircuit: boolean;
}>;
//# sourceMappingURL=coverage-loader.d.ts.map