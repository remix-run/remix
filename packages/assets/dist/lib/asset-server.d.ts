import type { AssetTarget } from './target.ts';
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
     * Per-build invalidation token that must change whenever fingerprinted asset URLs
     * should be invalidated together.
     */
    buildId: string;
}
type AssetSourceMaps = 'inline' | 'external';
type AssetSourceMapSourcePaths = 'url' | 'absolute';
interface AssetServerScriptOptions {
    /**
     * Replace global expressions with constant values during transform, e.g.
     * `{ 'process.env.NODE_ENV': '"production"' }`
     */
    define?: Record<string, string>;
    /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
    external?: string[];
}
export interface AssetServerOptions {
    /** Public mount path for this asset server, e.g. `'/assets'`. */
    basePath: string;
    /** File patterns keyed by public URL patterns relative to `basePath`. */
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
     * Controls optional source-based URL fingerprinting for rewritten asset URLs.
     *
     * When omitted, all served assets use stable non-fingerprinted URLs with `Cache-Control: no-cache`.
     * Cannot be used together with active watch mode. Set `watch: false` when fingerprinting.
     */
    fingerprint?: FingerprintOptions;
    /**
     * Shared compatibility target for scripts and styles. Browser targets apply to both
     * pipelines, and `es` only affects scripts.
     */
    target?: AssetTarget;
    /**
     * Source map mode for scripts and styles.
     * - `'external'`: serve source maps as separate `.map` files
     * - `'inline'`: embed source maps as a base64 data URL in the compiled asset
     */
    sourceMaps?: AssetSourceMaps;
    /**
     * Source path strategy for source map `sources`.
     * - `'url'` (default): use the stable server path (e.g. `'/assets/app/entry.ts'`)
     * - `'absolute'`: use the original filesystem path on disk
     */
    sourceMapSourcePaths?: AssetSourceMapSourcePaths;
    /**
     * Minification setting for emitted scripts and styles.
     */
    minify?: boolean;
    /**
     * Script-only configuration.
     */
    scripts?: AssetServerScriptOptions;
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
     * Serves a script or style request. Returns `Response | null` — null means the request
     * was not handled by this server, letting the router fall through to a 404.
     */
    fetch(request: Request): Promise<Response | null>;
    /**
     * Returns the request href for a served asset file.
     */
    getHref(filePath: string): Promise<string>;
    /**
     * Returns preload URLs for one or more served asset files, ordered shallowest-first.
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
 * Compiles TypeScript/JavaScript scripts and CSS styles on demand with optional
 * source-based URL fingerprinting, caching, and configurable file mapping.
 *
 * @param options Server configuration
 * @returns A {@link AssetServer} with `fetch()`, `getHref()`, and `getPreloads()` methods
 *
 * @example
 * ```ts
 * let assetServer = createAssetServer({
 *   basePath: '/assets',
 *   fileMap: {
 *     '/app/*path': 'app/*path',
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