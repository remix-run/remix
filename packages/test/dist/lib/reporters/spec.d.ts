import type { Reporter, ReporterOptions } from './index.ts';
import type { Counts, TestResults } from './results.ts';
export declare class SpecReporter implements Reporter {
    #private;
    constructor(options?: ReporterOptions);
    onSectionStart(label: string): void;
    onResult(results: TestResults, env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
}
//# sourceMappingURL=spec.d.ts.map