export type Counts = {
    passed: number;
    failed: number;
    skipped: number;
    todo: number;
};
export declare const IS_BUN: boolean;
export declare const colors: {
    reset: string;
    dim: import("@remix-run/terminal").TerminalStyle;
    green: import("@remix-run/terminal").TerminalStyle;
    red: import("@remix-run/terminal").TerminalStyle;
    cyan: import("@remix-run/terminal").TerminalStyle;
    yellow(value: string): string;
};
export declare function normalizeLine(line: string): string;
//# sourceMappingURL=utils.d.ts.map