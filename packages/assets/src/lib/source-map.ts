// Parse inline source map from transformed code (exported for testing)
export function parseInlineSourceMap(code: string): {
  sources: string[]
  sourcesContent?: string[]
  mappings: string
} | null {
  // Use 'm' flag so $ matches end of line, not just end of string
  let match = code.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m)
  if (!match) return null

  try {
    let json = Buffer.from(match[1], 'base64').toString('utf-8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Fix source map sources array to use a single URL (e.g. module URL) so browser dev tools
 * organize the Sources panel correctly. Use when emitting maps (inline or external).
 *
 * @param mapJson Source map JSON string
 * @param sourceUrl URL for the original source (e.g. /app/entry.tsx)
 * @returns Fixed source map JSON string, or null if parsing fails
 */
export function fixSourceMapSources(mapJson: string, sourceUrl: string): string | null {
  try {
    let sourceMap = JSON.parse(mapJson)
    sourceMap.sources = [sourceUrl]
    return JSON.stringify(sourceMap)
  } catch {
    return null
  }
}

/**
 * Fix source map paths to use URL-based paths instead of filesystem-relative paths.
 * In an unbundled dev setup, each source file is served at its own URL, and the source map
 * should reference that URL (not a filesystem path) so browser dev tools organize the
 * Sources panel tree correctly.
 *
 * @param code Transformed code with inline source map
 * @param sourceUrl URL where this file is served (e.g., /assets/App.tsx)
 * @returns Code with fixed source map, or original code if no source map found
 */
export function fixSourceMapPaths(code: string, sourceUrl: string): string {
  // Find the inline source map in the code
  // Use 'm' flag so $ matches end of line, not just end of string
  let match = code.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m)
  if (!match) return code

  try {
    let json = Buffer.from(match[1], 'base64').toString('utf-8')
    let fixedJson = fixSourceMapSources(json, sourceUrl)
    if (fixedJson === null) return code
    let fixedBase64 = Buffer.from(fixedJson).toString('base64')

    return code.replace(
      /\/\/# sourceMappingURL=data:application\/json;base64,.+$/m,
      `//# sourceMappingURL=data:application/json;base64,${fixedBase64}`,
    )
  } catch {
    return code
  }
}
