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
    // Parse the source map
    let json = Buffer.from(match[1], 'base64').toString('utf-8')
    let sourceMap = JSON.parse(json)

    // Replace the sources array with the sourceUrl
    // This ensures the browser dev tools organize files by their URL structure
    sourceMap.sources = [sourceUrl]

    // Keep sourcesContent as-is (contains the actual TypeScript source)
    // Note: sourcesContent is already embedded by esbuild

    // Re-encode the fixed source map
    let fixedJson = JSON.stringify(sourceMap)
    let fixedBase64 = Buffer.from(fixedJson).toString('base64')

    // Replace the source map in the code
    // Use 'm' flag so $ matches end of line, not just end of string
    return code.replace(
      /\/\/# sourceMappingURL=data:application\/json;base64,.+$/m,
      `//# sourceMappingURL=data:application/json;base64,${fixedBase64}`,
    )
  } catch {
    // If parsing fails, return original code
    return code
  }
}
