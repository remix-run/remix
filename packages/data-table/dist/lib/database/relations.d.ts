import type { AnyRelation, AnyTable } from '../table.ts';
import type { QueryExecutionContext } from './execution-context.ts';
export declare function loadRelationsForRows(database: QueryExecutionContext, sourceTable: AnyTable, rows: Record<string, unknown>[], relationMap: Record<string, AnyRelation>): Promise<Record<string, unknown>[]>;
//# sourceMappingURL=relations.d.ts.map