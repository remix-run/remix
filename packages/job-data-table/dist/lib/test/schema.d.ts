import type { Database } from '@remix-run/data-table';
export declare let DEFAULT_TEST_TABLE_PREFIX: string;
export declare function setupJobStorageSchema(db: Database, tablePrefix?: string): Promise<void>;
export declare function resetJobStorageSchema(db: Database, tablePrefix?: string): Promise<void>;
//# sourceMappingURL=schema.d.ts.map