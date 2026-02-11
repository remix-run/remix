import type { AdapterExecuteRequest, AdapterResult, DatabaseAdapter, TransactionOptions, TransactionToken } from '@remix-run/data-table';
export type PostgresQueryResult = {
    rows: unknown[];
    rowCount: number | null;
};
export type PostgresDatabaseClient = {
    query(text: string, values?: unknown[]): Promise<PostgresQueryResult>;
};
export type PostgresTransactionClient = PostgresDatabaseClient & {
    release?: () => void;
};
export type PostgresDatabasePool = PostgresDatabaseClient & {
    connect?: () => Promise<PostgresTransactionClient>;
};
export type PostgresDatabaseAdapterOptions = {
    capabilities?: {
        returning?: boolean;
        savepoints?: boolean;
        upsert?: boolean;
    };
};
export declare class PostgresDatabaseAdapter implements DatabaseAdapter {
    #private;
    dialect: string;
    capabilities: {
        returning: boolean;
        savepoints: boolean;
        upsert: boolean;
    };
    constructor(client: PostgresDatabasePool, options?: PostgresDatabaseAdapterOptions);
    execute(request: AdapterExecuteRequest): Promise<AdapterResult>;
    beginTransaction(options?: TransactionOptions): Promise<TransactionToken>;
    commitTransaction(token: TransactionToken): Promise<void>;
    rollbackTransaction(token: TransactionToken): Promise<void>;
    createSavepoint(token: TransactionToken, name: string): Promise<void>;
    rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
    releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
}
export declare function createPostgresDatabaseAdapter(client: PostgresDatabasePool, options?: PostgresDatabaseAdapterOptions): PostgresDatabaseAdapter;
//# sourceMappingURL=adapter.d.ts.map