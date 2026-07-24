import type { RemixDbAdapterConfig } from './remix-config.ts';
export type DatabaseCommand = 'migrate' | 'reset' | 'seed' | 'status' | 'wipe';
export interface DatabaseCommandInvocation {
    command: DatabaseCommand;
    connectionEnv?: string;
    journalTable?: string;
    migrations?: string;
    seed?: string;
    to?: string;
}
export interface DatabaseCommandPlan {
    adapter: RemixDbAdapterConfig;
    command: DatabaseCommand;
    journalTable?: string;
    migrations?: string;
    seed?: string;
    to?: string;
}
export declare function isDatabaseCommand(value: unknown): value is DatabaseCommand;
//# sourceMappingURL=database-command.d.ts.map