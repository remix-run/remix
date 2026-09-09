import { type RemixConfig } from './remix-config.ts';
interface ResolveCliContextOptions {
    configPath?: string;
    cwd?: string;
    remixVersion?: string;
}
export interface CliContext {
    /** Explicit Remix configuration path selected by the caller. */
    configPath?: string;
    cwd: string;
    /** Loads and validates the Remix config file, memoizing the result. */
    loadConfig(): Promise<RemixConfig>;
    remixVersion?: string;
}
export declare function resolveCliContext(options?: ResolveCliContextOptions): Promise<CliContext>;
export {};
//# sourceMappingURL=cli-context.d.ts.map