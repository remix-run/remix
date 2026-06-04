import type { DataManipulationOperation, DataManipulationResult, DatabaseAdapter } from '../adapter.ts';
import type { Database } from '../database.ts';
export declare const executeOperation: unique symbol;
export type QueryExecutionContext = {
    adapter: DatabaseAdapter;
    now(): unknown;
    transaction<result>(callback: (database: Database) => Promise<result>): Promise<result>;
    [executeOperation](operation: DataManipulationOperation): Promise<DataManipulationResult>;
};
//# sourceMappingURL=execution-context.d.ts.map