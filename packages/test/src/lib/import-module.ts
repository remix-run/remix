import { tsImport } from 'tsx/esm/api'
import { IS_BUN } from './utils'

interface ImportMetaWithResolve extends ImportMeta {
  resolve(specifier: string, parent?: string | URL): string
}

function hasImportMetaResolve(meta: ImportMeta): meta is ImportMetaWithResolve {
  return 'resolve' in meta && typeof meta.resolve === 'function'
}

/**
 * Loads a module specifier relative to the caller's module context.
 *
 * @param specifier The module specifier or file path to load.
 * @param meta The caller's `import.meta`, used as the context for resolution.
 * @returns The imported module namespace.
 */
export async function importModule(specifier: string, meta: ImportMeta) {
  if (IS_BUN) {
    if (!hasImportMetaResolve(meta)) {
      throw new Error('importModule() requires import.meta.resolve() in Bun')
    }

    return import(meta.resolve(specifier, meta.url))
  }

  return tsImport(specifier, meta.url)
}
