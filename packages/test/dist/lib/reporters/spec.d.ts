import { type Counts } from '../utils.ts';
import type { TestResults } from '../executor.ts';
import type { Reporter } from './index.ts';
export declare class SpecReporter implements Reporter {
    #private;
    onSectionStart(label: string): void;
    onResult(results: TestResults, env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
}
//# sourceMappingURL=spec.d.ts.map