export interface ScriptHandlerOptions {
    /** Configured source roots that may be served by this handler */
    roots: ReadonlyArray<{
        /** Public URL prefix under `base` (e.g. `'packages'`) */
        prefix?: string;
        /** Filesystem directory for this served tree */
        directory: string;
        /** Declared entry point paths or glob patterns relative to this directory */
        entryPoints?: readonly string[];
    }>;
    /**
     * URL base path where the handler is mounted (e.g. `'/scripts'`).
     * All rewritten import URLs in compiled modules will be relative to this base.
     */
    base: string;
    /**
     * Source map mode (disabled when omitted).
     * - `'external'`: serve source maps as separate `.map` files; adds `//# sourceMappingURL=` comment
     * - `'inline'`: embed source maps as a base64 data URL directly in the JS; no separate `.map` file
     */
    sourceMaps?: 'inline' | 'external';
    /**
     * Controls the source paths written into sourcemap `sources`.
     * - `'virtual'` (default): use the stable handler path (e.g. `'/scripts/app/entry.ts'`)
     * - `'absolute'`: use the original filesystem path on disk
     */
    sourceMapSourcePaths?: 'virtual' | 'absolute';
    /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
    external?: string | string[];
    /**
     * Handles unexpected compilation errors. Return a `Response` to override the default
     * `500 Internal Server Error` response, or return nothing to use the default.
     */
    onError?: (error: unknown) => void | Response | Promise<void | Response>;
}
export interface ScriptHandler {
    /**
     * Handles a request for a script module path. Returns `Response | null` — null means
     * the request was not handled by this handler, letting the router fall through to a 404.
     */
    handle(request: Request, path: string): Promise<Response | null>;
    /**
     * Returns preload URLs for all transitive deps of the given entry point, ordered
     * shallowest-first. Pass either the public entry-point path relative to `base` or an
     * absolute file path for a configured entry point. Call this when rendering HTML to
     * populate `<link rel="modulepreload">`.
     *
     * Blocks until the module graph is fully built. Not calling `preloads()` is valid —
     * modules are compiled on-demand as the browser requests them.
     */
    preloads(entryPoint: string): Promise<string[]>;
}
/**
 * Create the server-side scripts handler.
 *
 * Compiles TypeScript/JavaScript modules on demand with content-addressed URLs:
 * - Internal modules served at `.@hash` URLs with `Cache-Control: immutable`
 * - Entry points served with `Cache-Control: no-cache` + ETags
 * - Circular dependencies handled via Tarjan's SCC algorithm — modules in a cycle
 *   share a deterministic hash derived from their combined sources and external deps
 * - CommonJS detection with clear error messages
 * - GET and HEAD support
 *
 * @param options Handler configuration
 * @returns A {@link ScriptHandler} with `handle()` and `preloads()` methods
 *
 * @example
 * ```ts
 * let scripts = createScriptHandler({
 *   base: '/scripts',
 *   roots: [{ directory: import.meta.dirname, entryPoints: ['app/entry.tsx'] }],
 * })
 *
 * route('/scripts/*path', ({ request, params }) => scripts.handle(request, params.path))
 * ```
 */
export declare function createScriptHandler(options: ScriptHandlerOptions): ScriptHandler;
//# sourceMappingURL=script-handler.d.ts.map