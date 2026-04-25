import type { JobStorage } from '../storage.ts';
export interface StorageContractOptions<transaction = never> {
    integrationEnabled?: boolean;
    setup?: () => Promise<void>;
    createStorage: () => Promise<JobStorage<transaction>> | JobStorage<transaction>;
}
export declare function runJobStorageContract<transaction = never>(name: string, options: StorageContractOptions<transaction>): void;
//# sourceMappingURL=storage-contract.d.ts.map