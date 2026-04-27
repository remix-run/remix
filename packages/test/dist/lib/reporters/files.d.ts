import { type Counts } from '../utils.ts';
import type { TestResults } from '../executor.ts';
import type { Reporter } from './index.ts';
export declare class FilesReporter implements Reporter {
    #private;
    onSectionStart(_label: string): void;
    onResult(results: TestResults, env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
}
//# sourceMappingURL=files.d.ts.map