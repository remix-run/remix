import type { ChokidarWatcher } from './watch.ts';
interface AssetServerWatchOptions {
    /**
     * Ignore matching glob patterns or file paths. Relative values are resolved
     * from `rootDir`.
     */
    ignore?: readonly string[];
    /**
     * Use polling instead of native filesystem events. Defaults to `false`.
     */
    poll?: boolean;
    /**
     * Polling interval in milliseconds when `poll` is enabled. Defaults to `100`.
     */
    pollInterval?: number;
}
interface FingerprintOptions {
    /**
     * Per-build invalidation token that must change whenever fingerprinted module URLs
     * should be invalidated together.
     */
    buildId: string;
}
declare const scriptTargets: readonly ["es2015", "es2016", "es2017", "es2018", "es2019", "es2020", "es2021", "es2022", "es2023", "es2024", "es2025", "es2026", "esnext"];
export type ScriptsTarget = (typeof scriptTargets)[number];
export interface AssetServerOptions {
    /** File patterns keyed by public URL patterns. */
    fileMap: Readonly<Record<string, string>>;
    /**
     * Root directory used to resolve relative file paths. Defaults to `process.cwd()`.
     */
    rootDir?: string;
    /**
     * Glob patterns or file paths that are allowed to be served. Relative values are resolved from `rootDir`.
     */
    allow: readonly string[];
    /**
     * Glob patterns or file paths that are denied from being served. Relative values are resolved from `rootDir`.
     */
    deny?: readonly string[];
    /**
     * Controls optional source-based URL fingerprinting for rewritten import URLs.
     *
     * When omitted, all served modules use stable non-fingerprinted URLs with `Cache-Control: no-cache`.
     * Cannot be used together with active watch mode. Set `watch: false` when fingerprinting.
     */
    fingerprint?: FingerprintOptions;
    /**
     * Script pipeline configuration. Omit to use defaults.
     */
    scripts?: {
        /**
         * Source map mode (disabled when omitted).
         * - `'external'`: serve source maps as separate `.map` files; adds `//# sourceMappingURL=` comment
         * - `'inline'`: embed source maps as a base64 data URL directly in the JS; no separate `.map` file
         */
        sourceMaps?: 'inline' | 'external';
        /**
         * Controls the source paths written into source map `sources`.
         * - `'url'` (default): use the stable server path (e.g. `'/assets/app/entry.ts'`)
         * - `'absolute'`: use the original filesystem path on disk
         */
        sourceMapSourcePaths?: 'url' | 'absolute';
        /**
         * Minify emitted modules.
         */
        minify?: boolean;
        /**
         * Replace global expressions with constant values during transform, e.g.
         * `{ 'process.env.NODE_ENV': '"production"' }`
         */
        define?: Record<string, string>;
        /**
         * Lower emitted syntax to a specific ECMAScript target. Omit this option to preserve
         * modern syntax unless project configuration already requests a lower target.
         */
        target?: ScriptsTarget;
        /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
        external?: string[];
    };
    /**
     * Enable filesystem-backed cache invalidation for long-lived server instances.
     * Enabled by default. Pass `true` to use the default watcher options, an options
     * object to customize watcher behavior, or `false` to disable watching.
     */
    watch?: boolean | AssetServerWatchOptions;
    /**
     * Handles unexpected request-time compilation errors. Return a `Response` to override the
     * default `500 Internal Server Error` response, or return nothing to use the default.
     */
    onError?: (error: unknown) => void | Response | Promise<void | Response>;
}
export interface AssetServer {
    /**
     * Serves a script request. Returns `Response | null` — null means the request was not
     * handled by this server, letting the router fall through to a 404.
     */
    fetch(request: Request): Promise<Response | null>;
    /**
     * Returns the request href for a served module file.
     */
    getHref(filePath: string): Promise<string>;
    /**
     * Returns preload URLs for one or more served module files, ordered shallowest-first.
     */
    getPreloads(filePath: string | readonly string[]): Promise<string[]>;
    /**
     * Closes any watcher resources owned by this server instance.
     */
    close(): Promise<void>;
}
export declare function getInternalChokidarWatcher(assetServer: AssetServer): ChokidarWatcher | undefined;
export declare function getInternalWatchTargets(assetServer: AssetServer): readonly string[];
/**
 * Create an asset server instance
 *
 * Compiles TypeScript/JavaScript modules on demand with optional source-based URL
 * fingerprinting, caching, and configurable file mapping.
 *
 * @param options Server configuration
 * @returns A {@link AssetServer} with `fetch()`, `getHref()`, and `getPreloads()` methods
 *
 * @example
 * ```ts
 * let assetServer = createAssetServer({
 *   fileMap: {
 *     '/assets/app/*path': 'app/*path',
 *   },
 *   allow: ['app/**'],
 * })
 *
 * route('/assets/*path', ({ request }) => assetServer.fetch(request))
 * ```
 */
export declare function createAssetServer(options: AssetServerOptions): AssetServer;
export {};
//# sourceMappingURL=asset-server.d.ts.map