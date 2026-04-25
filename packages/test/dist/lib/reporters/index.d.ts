import type { Counts } from '../utils.ts';
import type { TestResults } from '../executor.ts';
import { SpecReporter } from './spec.ts';
import { TapReporter } from './tap.ts';
import { DotReporter } from './dot.ts';
import { FilesReporter } from './files.ts';
export interface Reporter {
    onResult(results: TestResults, env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
    onSectionStart(label: string): void;
}
export { SpecReporter, TapReporter, DotReporter, FilesReporter };
export declare function createReporter(type: string): Reporter;
//# sourceMappingURL=index.d.ts.map