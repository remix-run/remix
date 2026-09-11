import { type CreateTestContextE2EOptions } from './context.ts';
import type { TestResults } from './reporters/results.ts';
import type { SerializedOnlyPattern } from './config.ts';
type RunTestsE2EOptions = Omit<CreateTestContextE2EOptions, 'addE2ECoverageEntries'>;
export interface RunTestsOptions extends Partial<RunTestsE2EOptions> {
    only?: SerializedOnlyPattern[];
}
export declare function runTests(options?: RunTestsOptions): Promise<TestResults>;
export {};
//# sourceMappingURL=executor.d.ts.map