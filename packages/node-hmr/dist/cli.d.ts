export interface RunOptions {
    browserEventChannel?: boolean | BrowserEventChannelOptions;
    cwd?: string;
    entryArgs?: readonly string[];
    env?: NodeJS.ProcessEnv;
    nodeArgs?: readonly string[];
}
export interface BrowserEventChannelOptions {
    host?: string;
    port?: number;
    pathname?: string;
}
export interface NodeHmrRunner {
    close(): Promise<void>;
}
export declare function run(entry: string, options?: RunOptions): NodeHmrRunner;
export declare function buildNodeArgs(options: {
    browserEventUrl?: string;
    entry: string;
    entryArgs: Array<string>;
    nodeArgs: Array<string>;
    registerPath: string;
    rootPath?: string;
}): Array<string>;
//# sourceMappingURL=cli.d.ts.map