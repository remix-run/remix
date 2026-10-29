type ModuleNamespace = Record<string, unknown>;
/**
 * Detects whether the current document can install multiple import maps.
 *
 * Returns `true` only when an isolated feature test verifies support. If the test cannot run or
 * complete under the document's Content Security Policy, this returns `false`. When the polyfill
 * is required, its runtime begins loading in the background.
 *
 * @returns Whether multiple import map support was verified.
 */
export declare function detectMultipleImportMapSupport(): Promise<boolean>;
/**
 * Loads a JavaScript module, using the multiple import map polyfill when required.
 *
 * @param specifier Module specifier to load.
 * @param parentUrl URL to resolve the specifier from. (default: `document.baseURI`)
 * @returns The loaded module namespace.
 */
export declare function importModule(specifier: string, parentUrl?: string): Promise<ModuleNamespace>;
/**
 * Loads a JavaScript module through the polyfill using every import map currently installed in the
 * document. This function does not detect native multiple import map support.
 *
 * @param specifier Module specifier to load.
 * @param parentUrl URL to resolve the specifier from. (default: `document.baseURI`)
 * @returns The loaded module namespace.
 */
export declare function importShim(specifier: string, parentUrl?: string): Promise<ModuleNamespace>;
/**
 * Fetches one or more JavaScript modules through the polyfill for a later polyfilled import. This
 * function does not use native module preloads.
 *
 * Preload failures are ignored. A later import reports the failure if the module is required.
 *
 * @param specifiers Module specifier or specifiers to preload.
 * @param parentUrl URL to resolve the specifiers from. (default: `document.baseURI`)
 * @returns A promise that settles after all module fetches have completed.
 */
export declare function preloadShim(specifiers: string | readonly string[], parentUrl?: string): Promise<void>;
export {};
//# sourceMappingURL=polyfill.d.ts.map