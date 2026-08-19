import type { AssetRequestTransformMap, AssetServerFilesOptions, AssetTransformInvocation } from './files/config.ts';
import type { HmrPayload } from './hmr.ts';
import type { ModuleLoader } from './loaders.ts';
import type { ScriptHmrUpdate } from './scripts/compiler.ts';
import type { AssetTarget } from './target.ts';
import { type AssetDetails } from './inspection.ts';
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
 * Bridge used by an asset server to watch browser source files and publish update events through a
 * server-level HMR runtime.
 *
 * The asset server registers its file handler, keeps the channel's watched-file set in sync with
 * compiled assets, injects `url` into its browser HMR client, and closes the channel when the asset
 * server closes.
 */
export interface BrowserHmrChannel {
    /** Absolute EventSource URL that receives the browser HMR events produced by this channel. */
    readonly url: string;
    /** Releases the channel and all file-watching resources it owns. */
    close(): void;
    /**
     * Registers the asset server's handler for file changes reported by the channel's watcher.
     *
     * @param handler Callback that converts a batch of file changes into browser update or reload
     * events.
     * @returns A cleanup function that stops forwarding file changes to this handler.
     */
    onFileEvents(handler: BrowserHmrFileEventHandler): () => void;
    /**
     * Applies additions and removals to the channel's set of watched absolute file paths.
     *
     * @param delta Files to add and remove from the watcher.
     */
    updateWatchedFiles(delta: BrowserHmrWatchedFileDelta): void;
}
/**
 * Creates the browser HMR channel owned by an asset server instance.
 *
 * Returning `undefined` leaves browser HMR inactive. The asset server invokes this factory once,
 * after construction, and closes a returned channel from `assetServer.close()`.
 *
 * @returns A channel, no channel, or a promise for either result.
 */
export type BrowserHmrChannelFactory = () => BrowserHmrChannel | undefined | Promise<BrowserHmrChannel | undefined>;
/**
 * Converts a watcher batch into ordered browser update or reload events.
 *
 * @param events File additions, changes, and removals reported together by the watcher.
 * @returns Browser events to publish in their returned order.
 */
export type BrowserHmrFileEventHandler = (events: readonly BrowserHmrFileEvent[]) => Promise<readonly BrowserHmrEvent[]>;
/**
 * Watched file delta for a browser HMR channel.
 */
export interface BrowserHmrWatchedFileDelta {
    /** Absolute source file paths newly required by the asset server's compiled module graph. */
    add: readonly string[];
    /** Absolute source file paths no longer required by the asset server's compiled module graph. */
    remove: readonly string[];
}
/**
 * File watcher event reported to a browser HMR channel.
 */
export type BrowserHmrFileEvent = {
    /** Filesystem operation observed by the channel's watcher. */
    event: 'add' | 'change' | 'unlink';
    /** Absolute path of the source file that changed. */
    filePath: string;
};
/**
 * Browser HMR event emitted to connected clients.
 */
export type BrowserHmrEvent = {
    /** Absolute source file paths that triggered this update. */
    files?: string[];
    /** Update time used to bypass browser module and stylesheet caches. */
    timestamp: number;
    /** Browser update event. */
    type: 'update';
    /** Accepted JavaScript and CSS module updates for the browser to apply in place. */
    updates: Extract<HmrPayload, {
        type: 'browser:update';
    }>['updates'];
} | {
    /** Absolute source file paths that could not be handled in place. */
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
     * Synchronous loaders that post-process compiled JavaScript.
     *
     * Loaders use Node's synchronous `load` hook signature. Later loaders wrap earlier loaders: for
     * `[first, second]`, `second` is entered first and delegates through `first` to the default
     * behavior. As a result, transformations performed after `nextLoad()` are applied in array order.
     * Loaders run after TypeScript/JavaScript transformation and before HMR analysis and minification.
     * Only `format: 'module'` is supported, and import attributes are unsupported.
     */
    loaders?: readonly ModuleLoader[];
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
    allowFiles: readonly string[];
    /**
     * Exact package names whose files are allowed to be served. Dependencies and installed optional
     * dependencies are allowed automatically. Package files must still match `fileMap`.
     */
    allowPackages?: readonly string[];
    /**
     * Glob patterns or file paths that are denied from being served. Relative values are resolved from `rootDir`.
     */
    denyFiles?: readonly string[];
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
     * Enables `import.meta.hot` and coordinates browser updates through a server-level HMR runtime.
     *
     * HMR requires `watch` to be enabled. The factory is called once for this asset server. Returning
     * `undefined` leaves HMR inactive; a returned channel is closed by `assetServer.close()`.
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
     * Returns diagnostic details about one public asset URL or file path, including the matched URL
     * and file patterns, access rules, file type, and browser-reachability status.
     */
    getAssetDetails(input: string): Promise<AssetDetails>;
    /**
     * Returns every file currently reachable through this asset server, sorted by public URL and
     * then absolute file path.
     */
    getAssets(): Promise<AssetDetails[]>;
    /**
     * Closes this server's filesystem watcher and browser HMR channel.
     *
     * @returns A promise that resolves after owned development resources have been released.
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
 *   allowFiles: ['app/routes.ts', 'app/**\/public/**'],
 *   allowPackages: ['remix'],
 *   denyFiles: ['app/**\/*.test.*'],
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