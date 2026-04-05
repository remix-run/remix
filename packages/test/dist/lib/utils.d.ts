export type Counts = {
    passed: number;
    failed: number;
    skipped: number;
    todo: number;
};
export declare const colors: {
    reset: string;
    dim: (s: string) => string;
    green: (s: string) => string;
    red: (s: string) => string;
    cyan: (s: string) => string;
    yellow: (s: string) => string;
};
export declare function normalizeLine(line: string): string;
//# sourceMappingURL=utils.d.ts.map