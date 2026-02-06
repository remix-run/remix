/**
 * Utilities for parsing and analyzing ES module imports.
 *
 * These functions extract import information from source code using es-module-lexer,
 * and provide utilities for detecting module types and extracting package names.
 */

import { init as lexerInit, parse as parseImports } from 'es-module-lexer'

// es-module-lexer init promise (must await before parsing)
let lexerReady = lexerInit

/**
 * Extracts all import specifiers from source code.
 *
 * Uses es-module-lexer to parse static imports, dynamic imports with string literals,
 * and re-export statements (e.g., `export { x } from 'y'`).
 *
 * @param source The source code to analyze
 * @returns Array of import specifiers with their positions in the source
 */
export async function extractImportSpecifiers(
  source: string,
): Promise<Array<{ specifier: string; start: number; end: number }>> {
  await lexerReady
  let [imports] = parseImports(source)

  let result: Array<{ specifier: string; start: number; end: number }> = []
  for (let imp of imports) {
    if (imp.n != null) {
      result.push({
        specifier: imp.n,
        start: imp.s,
        end: imp.e,
      })
    }
  }
  return result
}

/**
 * Extracts the package name from an import specifier.
 *
 * Examples:
 * - `'lodash'` → `'lodash'`
 * - `'lodash/map'` → `'lodash'`
 * - `'@remix-run/component'` → `'@remix-run/component'`
 * - `'@remix-run/component/jsx-runtime'` → `'@remix-run/component'`
 *
 * @param specifier The import specifier
 * @returns The package name, or null if it cannot be determined
 */
export function getPackageName(specifier: string): string | null {
  if (specifier.startsWith('@')) {
    let parts = specifier.split('/')
    if (parts.length >= 2) {
      return parts[0] + '/' + parts[1]
    }
  } else {
    let parts = specifier.split('/')
    return parts[0]
  }
  return null
}

/**
 * Detects if source code is CommonJS (vs ES modules).
 *
 * Checks for:
 * - `module.exports` assignments
 * - `exports.property` assignments
 * - `require()` calls without ESM syntax
 *
 * @param source The source code to analyze
 * @returns true if the source appears to be CommonJS
 */
export function isCommonJS(source: string): boolean {
  if (/\bmodule\.exports\b/.test(source)) {
    return true
  }
  if (/\bexports\.[a-zA-Z_$]/.test(source)) {
    return true
  }
  let hasESMSyntax = /\b(import|export)\s/.test(source)
  if (!hasESMSyntax && /\brequire\s*\(/.test(source)) {
    return true
  }
  return false
}
