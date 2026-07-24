import type { RemixTestPool } from '@remix-run/test/cli';
declare const reporters: readonly ["spec", "files", "tap", "dot"];
declare const testTypes: readonly ["server", "browser", "e2e"];
type Reporter = (typeof reporters)[number];
type TestPool = RemixTestPool;
type TestType = (typeof testTypes)[number];
export interface RemixConfig {
    db?: RemixDbCommandConfig;
    doctor?: RemixDoctorCommandConfig;
    test?: RemixTestCommandConfig;
}
export type RemixDbString = string | {
    env: string;
    default?: string;
};
export type RemixDbAdapterConfig = {
    type: 'sqlite';
    filename: RemixDbString;
    foreignKeys?: boolean;
    busyTimeout?: number;
} | {
    type: 'postgres';
    connectionString: RemixDbString;
    maintenanceDatabase?: string;
    template?: string;
} | {
    type: 'mysql';
    uri: RemixDbString;
    characterSet?: string;
    collation?: string;
};
export interface RemixDbCommandConfig {
    adapter: RemixDbAdapterConfig;
    migrations?: {
        directory: string;
        journalTable?: string;
    };
    seed?: string;
}
export interface RemixDoctorCommandConfig {
    strict?: boolean;
}
export interface RemixTestCommandConfig {
    browserFiles?: string[];
    concurrency?: number;
    coverage?: {
        branches?: number;
        dir?: string;
        enabled?: boolean;
        exclude?: string[];
        functions?: number;
        include?: string[];
        lines?: number;
        statements?: number;
    };
    e2eFiles?: string[];
    exclude?: string[];
    files?: string[];
    only?: string[];
    playwright?: {
        configFile?: string;
        echo?: boolean;
        open?: boolean;
        projects?: string[];
    };
    pool?: TestPool;
    quiet?: boolean;
    reporter?: Reporter;
    setup?: string;
    type?: TestType[];
    watch?: boolean;
}
export declare function loadRemixConfig(cwd: string, configPath: string | undefined): Promise<RemixConfig>;
export {};
//# sourceMappingURL=remix-config.d.ts.map