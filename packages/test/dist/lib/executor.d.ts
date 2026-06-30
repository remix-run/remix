import { type CreateTestContextE2EOptions } from './context.ts';
import type { TestResults } from './reporters/results.ts';
import type { SerializedTestNamePattern } from './config.ts';
type RunTestsE2EOptions = Omit<CreateTestContextE2EOptions, 'addE2ECoverageEntries'>;
export interface RunTestsOptions extends Partial<RunTestsE2EOptions> {
    testNamePatterns?: SerializedTestNamePattern[];
}
export declare function runTests(options?: RunTestsOptions): Promise<TestResults>;
export {};
//# sourceMappingURL=executor.d.ts.map