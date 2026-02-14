import type { AdapterCapabilityOverrides, AdapterExecuteRequest, AdapterResult, DatabaseAdapter, TransactionOptions, TransactionToken } from '@remix-run/data-table';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
export type SqliteDatabaseConnection = BetterSqliteDatabase;
export type SqliteDatabaseAdapterOptions = {
    capabilities?: AdapterCapabilityOverrides;
};
export declare class SqliteDatabaseAdapter implements DatabaseAdapter {
    #private;
    dialect: string;
    capabilities: {
        returning: boolean;
        savepoints: boolean;
        upsert: boolean;
    };
    constructor(database: SqliteDatabaseConnection, options?: SqliteDatabaseAdapterOptions);
    execute(request: AdapterExecuteRequest): Promise<AdapterResult>;
    beginTransaction(options?: TransactionOptions): Promise<TransactionToken>;
    commitTransaction(token: TransactionToken): Promise<void>;
    rollbackTransaction(token: TransactionToken): Promise<void>;
    createSavepoint(token: TransactionToken, name: string): Promise<void>;
    rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
    releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
}
export declare function createSqliteDatabaseAdapter(database: SqliteDatabaseConnection, options?: SqliteDatabaseAdapterOptions): SqliteDatabaseAdapter;
//# sourceMappingURL=adapter.d.ts.map