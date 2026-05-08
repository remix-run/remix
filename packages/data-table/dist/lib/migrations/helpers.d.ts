import type { TableRef } from '../adapter.ts';
import type { IndexColumns, KeyColumns } from '../migrations.ts';
export declare function toTableRef(name: string): TableRef;
export declare function normalizeIndexColumns(columns: IndexColumns): string[];
export declare function normalizeKeyColumns(columns: KeyColumns): string[];
export declare function createPrimaryKeyName(table: TableRef): string;
export declare function createUniqueName(table: TableRef, columns: string[]): string;
export declare function createForeignKeyName(table: TableRef, columns: string[], references: TableRef, referenceColumns: string[]): string;
export declare function createCheckName(table: TableRef, expression: string): string;
export declare function createIndexName(table: TableRef, columns: string[]): string;
//# sourceMappingURL=helpers.d.ts.map