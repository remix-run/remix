export type DatabaseCommand = 'migrate' | 'reset' | 'seed' | 'status' | 'wipe';
export interface DatabaseCommandInvocation {
    command: DatabaseCommand;
    to?: string;
}
export declare function isDatabaseCommand(value: unknown): value is DatabaseCommand;
//# sourceMappingURL=database-command.d.ts.map