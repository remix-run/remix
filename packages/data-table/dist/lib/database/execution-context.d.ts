import type { DatabaseCapabilities, DataManipulationOperation, DataManipulationResult, TransactionOptions } from '../adapter.ts';
import type { Database } from '../database.ts';
export declare const executeOperation: unique symbol;
export declare const runInTransaction: unique symbol;
export type QueryExecutionContext = Database & {
    capabilities: DatabaseCapabilities;
    now(): unknown;
    [executeOperation](operation: DataManipulationOperation): Promise<DataManipulationResult>;
    [runInTransaction]<result>(callback: (database: QueryExecutionContext) => Promise<result>, options?: TransactionOptions): Promise<result>;
};
//# sourceMappingURL=execution-context.d.ts.map