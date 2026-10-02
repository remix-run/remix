export declare function initialize(data?: {
    namespace?: string;
}): void;
export declare function load(url: string, context: {
    format?: string;
}, nextLoad: (url: string, context: {
    format?: string;
}) => Promise<{
    format: string;
    source?: string;
    url?: string;
}>): Promise<{
    format: string;
    shortCircuit?: true;
    source?: string;
    url?: string;
}>;
export declare function resolve(specifier: string, context: {
    parentURL?: string;
}, nextResolve: (specifier: string, context: {
    parentURL?: string;
}) => Promise<{
    format?: string;
    url: string;
}>): Promise<{
    format?: string;
    url: string;
}>;
//# sourceMappingURL=register-hooks.d.ts.map