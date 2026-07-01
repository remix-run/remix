interface ResolveCliContextOptions {
    cwd?: string;
    remixVersion?: string;
}
export interface CliContext {
    cwd: string;
    remixVersion?: string;
}
export declare function resolveCliContext(options?: ResolveCliContextOptions): Promise<CliContext>;
export {};
//# sourceMappingURL=cli-context.d.ts.map