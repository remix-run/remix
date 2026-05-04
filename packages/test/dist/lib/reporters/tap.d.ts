import type { Reporter } from './index.ts';
import type { Counts, TestResults } from './results.ts';
export declare class TapReporter implements Reporter {
    #private;
    onSectionStart(_label: string): void;
    onResult(results: TestResults, env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
}
//# sourceMappingURL=tap.d.ts.map