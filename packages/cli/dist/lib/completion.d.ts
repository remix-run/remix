export interface CompletionResult {
    mode: 'files' | 'none' | 'values';
    values?: string[];
}
declare const COMPLETION_SHELLS: readonly ["bash", "zsh"];
export type CompletionShell = (typeof COMPLETION_SHELLS)[number];
export declare function isCompletionShell(value: string): value is CompletionShell;
export declare function getCompletionResult(words: string[], currentIndex: number): CompletionResult;
export declare function renderCompletionResult(result: CompletionResult): string;
export declare function getCompletionScript(): string;
export {};
//# sourceMappingURL=completion.d.ts.map