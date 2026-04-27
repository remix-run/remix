/**
 * Loads a module specifier relative to the caller's module context.
 *
 * @param specifier The module specifier or file path to load.
 * @param meta The caller's `import.meta`, used as the context for resolution.
 * @returns The imported module namespace.
 */
export declare function importModule(specifier: string, meta: ImportMeta): Promise<any>;
//# sourceMappingURL=import-module.d.ts.map