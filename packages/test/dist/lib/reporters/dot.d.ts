import type { Reporter, ReporterOptions } from './index.ts';
import type { Counts, TestResults } from './results.ts';
export declare class DotReporter implements Reporter {
    #private;
    constructor(options?: ReporterOptions);
    onSectionStart(_label: string): void;
    onResult(results: TestResults, _env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
}
//# sourceMappingURL=dot.d.ts.map