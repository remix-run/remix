import type { Reporter } from './index.ts';
import type { Counts, TestResults } from './results.ts';
export declare class SpecReporter implements Reporter {
    #private;
    onSectionStart(label: string): void;
    onResult(results: TestResults, env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
}
//# sourceMappingURL=spec.d.ts.map