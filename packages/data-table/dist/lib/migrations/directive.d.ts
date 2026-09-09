import type { MigrationTransactionMode } from '../migrations.ts';
/**
 * Parses an optional `-- data-table/transaction: auto|required|none` directive
 * from any single-line SQL comment in the script.
 *
 * Returns `undefined` when no directive is present.
 * @param sql SQL script contents.
 * @returns The declared transaction mode, or `undefined` when not declared.
 * @throws when more than one directive is present or the value is invalid.
 */
export declare function parseTransactionDirective(sql: string): MigrationTransactionMode | undefined;
//# sourceMappingURL=directive.d.ts.map