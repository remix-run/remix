import type { AdapterCapabilityOverrides, AdapterExecuteRequest, AdapterResult, DatabaseAdapter, TransactionOptions, TransactionToken } from '@remix-run/data-table';
export type MysqlQueryRows = Record<string, unknown>[];
export type MysqlQueryResultHeader = {
    affectedRows: number;
    insertId: unknown;
};
export type MysqlQueryResponse = [result: unknown, fields?: unknown];
export type MysqlDatabaseConnection = {
    query(text: string, values?: unknown[]): Promise<MysqlQueryResponse>;
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    release?: () => void;
};
export type MysqlDatabasePool = {
    query(text: string, values?: unknown[]): Promise<MysqlQueryResponse>;
    getConnection(): Promise<MysqlDatabaseConnection>;
};
export type MysqlDatabaseAdapterOptions = {
    capabilities?: AdapterCapabilityOverrides;
};
type MysqlQueryable = MysqlDatabasePool | MysqlDatabaseConnection;
export declare class MysqlDatabaseAdapter implements DatabaseAdapter {
    #private;
    dialect: string;
    capabilities: {
        returning: boolean;
        savepoints: boolean;
        upsert: boolean;
    };
    constructor(client: MysqlQueryable, options?: MysqlDatabaseAdapterOptions);
    execute(request: AdapterExecuteRequest): Promise<AdapterResult>;
    beginTransaction(options?: TransactionOptions): Promise<TransactionToken>;
    commitTransaction(token: TransactionToken): Promise<void>;
    rollbackTransaction(token: TransactionToken): Promise<void>;
    createSavepoint(token: TransactionToken, name: string): Promise<void>;
    rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
    releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
}
export declare function createMysqlDatabaseAdapter(client: MysqlQueryable, options?: MysqlDatabaseAdapterOptions): MysqlDatabaseAdapter;
export {};
//# sourceMappingURL=adapter.d.ts.map