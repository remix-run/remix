var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { IS_BUN } from "./runtime.js";
function hasImportMetaResolve(meta) {
    return 'resolve' in meta && typeof meta.resolve === 'function';
}
/*
 * Loads a module specifier relative to the caller's module context.
 *
 * @param specifier The module specifier or file path to load.
 * @param meta The caller's `import.meta`, used as the context for resolution.
 * @returns The imported module namespace.
 */
export async function importModule(specifier, meta) {
    // Absolute Windows paths (`C:\foo\bar.ts`) aren't valid ESM specifiers — only
    // `file:///C:/foo/bar.ts` URLs, relative specifiers, or POSIX absolute paths
    // are. Convert any absolute filesystem path to its `file:` URL so loaders like
    // `tsImport` and `import()` accept it on every platform. POSIX absolute paths
    // happen to work as specifiers without conversion, but going through
    // `pathToFileURL` is safe and platform-agnostic.
    let resolvedSpecifier = path.isAbsolute(specifier) ? pathToFileURL(specifier).href : specifier;
    if (IS_BUN) {
        if (!hasImportMetaResolve(meta)) {
            throw new Error('importModule() requires import.meta.resolve() in Bun');
        }
        return import(__rewriteRelativeImportExtension(meta.resolve(resolvedSpecifier, meta.url)));
    }
    return tsImport(resolvedSpecifier, meta.url);
}
