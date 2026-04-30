import type { Database } from '@remix-run/data-table';
export declare const DEFAULT_TEST_TABLE_PREFIX = "job_test_";
export declare function setupJobStorageSchema(db: Database, tablePrefix?: string): Promise<void>;
export declare function resetJobStorageSchema(db: Database, tablePrefix?: string): Promise<void>;
//# sourceMappingURL=schema.d.ts.map