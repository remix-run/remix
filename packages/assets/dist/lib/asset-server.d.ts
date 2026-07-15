import type { AssetRequestTransformMap, AssetServerFilesOptions, AssetTransformInvocation } from './files/config.ts';
import type { HmrPayload } from './hmr.ts';
import type { ModuleHooks } from './module-hooks.ts';
import type { ScriptHmrUpdate } from './scripts/compiler.ts';
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
/**
 * Browser HMR channel used by the asset server to coordinate browser updates.
 */
export interface BrowserHmrChannel {
    /** EventSource URL for browser HMR clients. */
    readonly url: string;
    /** Closes the channel and clears watched files. */
    close(): void;
    /**
     * Registers a file event handler.
     *
     * @param handler Callback that maps file events to browser HMR events.
     * @returns A cleanup function that unregisters the handler.
     */
    onFileEvents(handler: BrowserHmrFileEventHandler): () => void;
    /**
     * Updates the files watched on behalf of this channel.
     *
     * @param delta Files to add and remove from the watcher.
     */
    updateWatchedFiles(delta: BrowserHmrWatchedFileDelta): void;
}
/**
 * Creates a browser HMR channel for an asset server instance.
 */
export type BrowserHmrChannelFactory = () => BrowserHmrChannel | undefined | Promise<BrowserHmrChannel | undefined>;
/**
 * Handles changed files and returns browser HMR events to emit.
 */
export type BrowserHmrFileEventHandler = (events: readonly BrowserHmrFileEvent[]) => Promise<readonly BrowserHmrEvent[]>;
/**
 * Watched file delta for a browser HMR channel.
 */
export interface BrowserHmrWatchedFileDelta {
    /** Absolute file paths to start watching. */
    add: readonly string[];
    /** Absolute file paths to stop watching. */
    remove: readonly string[];
}
/**
 * File watcher event reported to a browser HMR channel.
 */
export type BrowserHmrFileEvent = {
    /** File watcher event type. */
    event: 'add' | 'change' | 'unlink';
    /** Absolute file path that changed. */
    filePath: string;
};
/**
 * Browser HMR event emitted to connected clients.
 */
export type BrowserHmrEvent = {
    /** Source files that triggered this update. */
    files?: string[];
    /** Update timestamp used to bust browser caches. */
    timestamp: number;
    /** Browser update event. */
    type: 'update';
    /** JavaScript and CSS updates for the browser to apply. */
    updates: Extract<HmrPayload, {
        type: 'browser:update';
    }>['updates'];
} | {
    /** Source files that triggered this reload. */
    files?: string[];
    /** Browser reload event. */
    type: 'reload';
};
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
    /**
     * Node's synchronous module hooks API for script modules. Only `format: 'module'` is supported.
     */
    moduleHooks?: readonly ModuleHooks[];
}
/**
 * Options used to construct an {@link AssetServer} via {@link createAssetServer}.
 */
export interface AssetServerOptions<transforms extends AssetRequestTransformMap = {}> {
    /** Public mount path for this asset server, e.g. `'/assets'`. */
    basePath: string;
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
     * Leaf file asset configuration. Files configured here are served directly and can be
     * referenced from CSS `url(...)` rules. Compiled asset extensions like `.css` and script
     * module extensions are not allowed here.
     */
    files?: AssetServerFilesOptions<transforms>;
    /**
     * Enable HMR via the import.meta.hot API using a browser HMR channel factory.
     * Browser HMR channels are designed to integrate with a server-level HMR
     * runtime so server and browser updates can be coordinated. HMR requires
     * `watch` to be enabled. The asset server creates one channel for this
     * server instance and closes it when `assetServer.close()` is called.
     */
    hmr?: BrowserHmrChannelFactory;
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
type AssetServerCreateOptions<transforms extends AssetRequestTransformMap> = Omit<AssetServerOptions<transforms>, 'files'> & {
    files?: Omit<AssetServerFilesOptions<transforms>, 'transforms'> & {
        transforms?: transforms;
    };
};
export type AssetServerGetHrefOptions<transforms extends AssetRequestTransformMap> = undefined | {
    transform: readonly AssetTransformInvocation<transforms>[];
};
/**
 * Serves compiled scripts and styles for asset requests routed to it.
 * Construct with {@link createAssetServer}.
 */
export interface AssetServer<transforms extends AssetRequestTransformMap = {}> {
    /**
     * Serves a script or style request. Returns `Response | null` — null means the request
     * was not handled by this server, letting the router fall through to a 404.
     */
    fetch(request: Request): Promise<Response | null>;
    /**
     * Returns the request href for a served asset file.
     */
    getHref(filePath: string, options?: AssetServerGetHrefOptions<transforms>): Promise<string>;
    /**
     * Returns preload URLs for one or more served asset files, ordered shallowest-first.
     */
    getPreloads(filePath: string | readonly string[]): Promise<string[]>;
    /**
     * Closes any watcher resources owned by this server instance.
     */
    close(): Promise<void>;
}
export declare function getInternalChokidarWatcher<transforms extends AssetRequestTransformMap>(assetServer: AssetServer<transforms>): ChokidarWatcher | undefined;
export declare function getInternalWatchTargets<transforms extends AssetRequestTransformMap>(assetServer: AssetServer<transforms>): readonly string[];
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
export declare function createAssetServer<const transforms extends AssetRequestTransformMap = {}>(options: AssetServerCreateOptions<transforms>): AssetServer<transforms>;
export declare function createScriptHmrPayload(updates: ScriptHmrUpdate[]): Extract<HmrPayload, {
    type: 'browser:reload' | 'browser:update';
}> | null;
export {};
//# sourceMappingURL=asset-server.d.ts.map