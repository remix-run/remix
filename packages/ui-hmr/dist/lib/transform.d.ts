/**
 * Result of analyzing and optionally rewriting a Remix UI component module for HMR.
 */
export interface ComponentsHmrTransformResult {
    /** Rewritten source, or the input source unchanged when `transformed` is `false`. */
    code: string;
    /** HMR-compatible component and client-entry export names found in the module. */
    componentNames: string[];
    /** Source map JSON when requested and transformed, otherwise `null`. */
    map: string | null;
    /** Whether the module formed a safe HMR boundary and `code` was rewritten. */
    transformed: boolean;
}
/**
 * Package prefix used for generated UI refresh and HMR runtime imports.
 *
 * Use `'remix'` for imports such as `remix/ui-hmr/runtime/browser`, `'@remix-run'` for the
 * equivalent scoped packages, or a custom prefix that exposes the same subpaths.
 */
export type UiHmrImportSource = 'remix' | '@remix-run' | (string & {});
/**
 * Options for rewriting browser component modules.
 */
export interface BrowserComponentsHmrTransformOptions {
    /** Package prefix used to generate UI refresh and browser HMR runtime imports. */
    importSource: UiHmrImportSource;
    /**
     * Stable public URL used to identify this module across browser updates.
     *
     * This must match the URL by which the browser imports the module, excluding transient cache
     * busting parameters.
     */
    moduleUrl: string;
    /** Whether to generate a source map for rewritten code. (`false`) */
    sourceMap?: boolean;
}
/**
 * Options for rewriting server component modules.
 */
export interface ServerComponentsHmrTransformOptions {
    /** Package prefix used to generate the server HMR runtime import. */
    importSource: UiHmrImportSource;
    /**
     * Stable module URL used to identify this module across server updates, typically its `file:` URL
     * without cache-busting search parameters.
     */
    moduleUrl: string;
    /** Whether to generate a source map for rewritten code. (`false`) */
    sourceMap?: boolean;
}
/**
 * Rewrites a browser Remix UI module to preserve compatible component instances across HMR updates.
 *
 * The transform instruments supported component and client-entry exports, registers their latest
 * implementations with the browser runtime, and injects an `import.meta.hot` accept boundary. If
 * parsing fails, no supported exports are found, or the module cannot be updated safely as a whole,
 * the source is returned unchanged with `transformed: false`.
 *
 * @param source Component module source code.
 * @param options Browser transform options.
 * @returns Rewritten source, discovered component names, and an optional source map.
 */
export declare function transformComponentsForBrowser(source: string, options: BrowserComponentsHmrTransformOptions): ComponentsHmrTransformResult;
/**
 * Rewrites a server Remix UI module so existing component wrappers call the latest implementation.
 *
 * The transform instruments supported component and client-entry exports and registers their
 * implementations under `moduleUrl`. If parsing fails, no supported exports are found, or the
 * module cannot be updated safely as a whole, the source is returned unchanged with
 * `transformed: false`.
 *
 * @param source Component module source code.
 * @param options Server transform options.
 * @returns Rewritten source, discovered component names, and an optional source map.
 */
export declare function transformComponentsForServer(source: string, options: ServerComponentsHmrTransformOptions): ComponentsHmrTransformResult;
//# sourceMappingURL=transform.d.ts.map