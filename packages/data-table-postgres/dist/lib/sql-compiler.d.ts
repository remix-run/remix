import type { AdapterStatement } from '@remix-run/data-table';
type CompiledSql = {
    text: string;
    values: unknown[];
};
export declare function compilePostgresStatement(statement: AdapterStatement): CompiledSql;
export {};
//# sourceMappingURL=sql-compiler.d.ts.map