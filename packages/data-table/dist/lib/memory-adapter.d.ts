import type { AdapterExecuteRequest, AdapterResult, DatabaseAdapter, TransactionToken } from './adapter.ts';
export type MemoryDatabaseSeed = Record<string, Record<string, unknown>[]>;
export type MemoryAdapterOptions = {
    returning?: boolean;
    upsert?: boolean;
};
export declare class MemoryDatabaseAdapter implements DatabaseAdapter {
    #private;
    dialect: string;
    capabilities: {
        returning: boolean;
        savepoints: boolean;
        upsert: boolean;
    };
    statements: AdapterExecuteRequest[];
    events: string[];
    constructor(seed?: MemoryDatabaseSeed, options?: MemoryAdapterOptions);
    execute(request: AdapterExecuteRequest): Promise<AdapterResult>;
    beginTransaction(): Promise<TransactionToken>;
    commitTransaction(token: TransactionToken): Promise<void>;
    rollbackTransaction(token: TransactionToken): Promise<void>;
    createSavepoint(token: TransactionToken, name: string): Promise<void>;
    rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
    releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
    seed(data: MemoryDatabaseSeed): void;
    snapshot(tableName: string): Record<string, unknown>[];
    clear(): void;
}
export declare function createMemoryDatabaseAdapter(seed?: MemoryDatabaseSeed, options?: MemoryAdapterOptions): MemoryDatabaseAdapter;
//# sourceMappingURL=memory-adapter.d.ts.map