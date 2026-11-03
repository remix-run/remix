import type { AnyQuery, QueryExecutionResult, QueryState } from '../query.ts';
import type { AnyTable } from '../table.ts';
import { type QueryExecutionContext } from './execution-context.ts';
export declare function executeQuery<input extends AnyQuery>(database: QueryExecutionContext, input: input): Promise<QueryExecutionResult<input>>;
export declare function loadRowsWithRelationsForQuery(database: QueryExecutionContext, input: AnyQuery): Promise<Record<string, unknown>[]>;
export declare function loadRowsWithRelationsForState(database: QueryExecutionContext, table: AnyTable, state: QueryState): Promise<Record<string, unknown>[]>;
//# sourceMappingURL=query-execution.d.ts.map