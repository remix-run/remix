import type { AssetServerOptions } from '@remix-run/assets';
import type { RemixTestPool } from '@remix-run/test/cli';
declare const reporters: readonly ['spec', 'files', 'tap', 'dot'];
declare const testTypes: readonly ['server', 'browser', 'e2e'];
type Reporter = (typeof reporters)[number];
type TestPool = RemixTestPool;
type TestType = (typeof testTypes)[number];
/** Validated configuration loaded from a Remix project config file. */
export interface RemixConfig {
    /** Shared asset mapping and browser access configuration. */
    assets?: RemixAssetsConfig;
    /** Database command configuration. */
    db?: RemixDbCommandConfig;
    /** Project health-check configuration. */
    doctor?: RemixDoctorCommandConfig;
    /** Test runner configuration. */
    test?: RemixTestCommandConfig;
}
/** JSON-compatible asset server configuration loaded from `remix.json`. */
export interface RemixAssetsConfig extends Pick<AssetServerOptions, 'allowFiles' | 'allowPackages' | 'basePath' | 'denyFiles' | 'mounts'> {
    /** Leaf file asset configuration. */
    files?: Pick<NonNullable<AssetServerOptions['files']>, 'extensions'>;
    /** Absolute root directory used to resolve asset file paths. */
    rootDir: string;
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
/**
 * Loads the nearest Remix project configuration or an explicitly selected config file.
 *
 * @param from A config file or directory from which to search upward for `remix.json`. Defaults to
 * `process.cwd()`.
 * @returns The validated Remix project configuration, or an empty object when no config is found.
 */
export declare function loadConfig(from?: string | URL): Promise<RemixConfig>;
export declare function loadRemixConfig(cwd: string, configPath: string | undefined): Promise<RemixConfig>;
export {};
//# sourceMappingURL=remix-config.d.ts.map