/**
 * Result of rewriting a Remix UI component module for HMR.
 */
export interface ComponentsHmrTransformResult {
    /** Transformed source code, or the original source when `transformed` is false. */
    code: string;
    /** Component export names found in the transformed module. */
    componentNames: string[];
    /** Source map JSON when source maps are enabled. */
    map: string | null;
    /** Whether the source was rewritten for component HMR. */
    transformed: boolean;
}
/**
 * Import namespace used for generated `ui` and `ui-hmr` imports.
 */
export type UiHmrImportSource = 'remix' | '@remix-run' | (string & {});
/**
 * Options for rewriting browser component modules.
 */
export interface BrowserComponentsHmrTransformOptions {
    /** Import namespace used to generate runtime imports such as `remix/ui-hmr/browser-runtime`. */
    importSource: UiHmrImportSource;
    /** Stable public module URL used as the component HMR identity. */
    moduleUrl: string;
    /** Whether to include a source map in the transform result. */
    sourceMap?: boolean;
}
/**
 * Options for rewriting server component modules.
 */
export interface ServerComponentsHmrTransformOptions {
    /** Import namespace used to generate runtime imports such as `remix/ui-hmr/server-runtime`. */
    importSource: UiHmrImportSource;
    /** Stable module URL used as the component HMR identity. */
    moduleUrl: string;
    /** Whether to include a source map in the transform result. */
    sourceMap?: boolean;
}
/**
 * Rewrites browser Remix UI component modules to keep component identity stable across HMR updates.
 *
 * @param source Component module source code.
 * @param options Browser transform options.
 * @returns The rewritten module source and metadata about transformed component exports.
 */
export declare function transformComponentsForBrowser(source: string, options: BrowserComponentsHmrTransformOptions): ComponentsHmrTransformResult;
/**
 * Rewrites server Remix UI component modules to keep component identity stable across HMR updates.
 *
 * @param source Component module source code.
 * @param options Server transform options.
 * @returns The rewritten module source and metadata about transformed component exports.
 */
export declare function transformComponentsForServer(source: string, options: ServerComponentsHmrTransformOptions): ComponentsHmrTransformResult;
//# sourceMappingURL=transform.d.ts.map