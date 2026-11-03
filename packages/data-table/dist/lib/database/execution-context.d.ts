import type { DatabaseCapabilities, DataManipulationOperation, DataManipulationResult, TransactionOptions } from '../driver.ts';
export declare const executeOperation: unique symbol;
export declare const runInTransaction: unique symbol;
export type QueryExecutionContext<dialect extends string = string> = {
    capabilities: DatabaseCapabilities;
    now(): unknown;
    [executeOperation](operation: DataManipulationOperation): Promise<DataManipulationResult>;
    [runInTransaction]<result>(callback: (database: QueryExecutionContext<dialect>) => Promise<result>, options?: TransactionOptions): Promise<result>;
};
//# sourceMappingURL=execution-context.d.ts.map