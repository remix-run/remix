import { type CreateTestContextOptions } from './context.ts';
import type { TestResults } from './reporters/results.ts';
export declare function runTests(options?: Omit<CreateTestContextOptions, 'addE2ECoverageEntries'>): Promise<TestResults>;
//# sourceMappingURL=executor.d.ts.map