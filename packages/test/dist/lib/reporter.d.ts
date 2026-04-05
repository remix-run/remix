import { type Counts } from './utils.ts';
import type { TestResults } from './executor.ts';
export interface Reporter {
    onResult(results: TestResults, env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
    onSectionStart(label: string): void;
}
export declare class SpecReporter implements Reporter {
    #private;
    onSectionStart(label: string): void;
    onResult(results: TestResults, env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
}
export declare class TapReporter implements Reporter {
    #private;
    onSectionStart(_label: string): void;
    onResult(results: TestResults, env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
}
export declare class DotReporter implements Reporter {
    #private;
    onSectionStart(_label: string): void;
    onResult(results: TestResults, _env?: string): void;
    onSummary(counts: Counts, durationMs: number): void;
}
export declare function createReporter(type: string): Reporter;
//# sourceMappingURL=reporter.d.ts.map