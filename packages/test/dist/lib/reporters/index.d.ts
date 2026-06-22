import { DotReporter } from './dot.ts';
import { FilesReporter } from './files.ts';
import type { Counts, TestResults } from './results.ts';
import { SpecReporter } from './spec.ts';
import { TapReporter } from './tap.ts';
export interface Reporter {
    onResult(results: TestResults, env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
    onSectionStart(label: string): void;
}
export { DotReporter, FilesReporter, SpecReporter, TapReporter };
export declare function createReporter(type: string): Reporter;
//# sourceMappingURL=index.d.ts.map