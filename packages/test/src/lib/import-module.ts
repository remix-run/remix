import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { tsImport } from 'tsx/esm/api'
import { IS_BUN } from './runtime.ts'

interface ImportMetaWithResolve extends ImportMeta {
  resolve(specifier: string, parent?: string | URL): string
}

function hasImportMetaResolve(meta: ImportMeta): meta is ImportMetaWithResolve {
  return 'resolve' in meta && typeof meta.resolve === 'function'
}

/*
 * Loads a module specifier relative to the caller's module context.
 *
 * @param specifier The module specifier or file path to load.
 * @param meta The caller's `import.meta`, used as the context for resolution.
 * @returns The imported module namespace.
 */
export async function importModule(specifier: string, meta: ImportMeta): Promise<any> {
  // Absolute Windows paths (`C:\foo\bar.ts`) aren't valid ESM specifiers — only
  // `file:///C:/foo/bar.ts` URLs, relative specifiers, or POSIX absolute paths
  // are. Convert any absolute filesystem path to its `file:` URL so loaders like
  // `tsImport` and `import()` accept it on every platform. POSIX absolute paths
  // happen to work as specifiers without conversion, but going through
  // `pathToFileURL` is safe and platform-agnostic.
  let resolvedSpecifier = path.isAbsolute(specifier) ? pathToFileURL(specifier).href : specifier

  if (IS_BUN) {
    if (!hasImportMetaResolve(meta)) {
      throw new Error('importModule() requires import.meta.resolve() in Bun')
    }

    return import(meta.resolve(resolvedSpecifier, meta.url))
  }

  return tsImport(resolvedSpecifier, meta.url)
}
