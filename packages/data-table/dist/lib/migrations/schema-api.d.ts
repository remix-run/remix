import type { Database } from '../database.ts';
import type { DataMigrationOperation, TransactionToken } from '../adapter.ts';
import type { MigrationSchema } from '../migrations.ts';
export declare function createMigrationSchema(db: Database, emit: (operation: DataMigrationOperation) => Promise<void>, options?: {
    transaction?: TransactionToken;
}): MigrationSchema;
//# sourceMappingURL=schema-api.d.ts.map