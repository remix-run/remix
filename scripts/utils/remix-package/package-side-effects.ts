import picomatch from 'picomatch'

export interface PackageExportSideEffects {
  published: boolean
  source: boolean
}

export interface SideEffectPatternPairingIssues {
  missingPublished: { source: string; expectedPublished: string }[]
  unsupportedPatterns: string[]
  unmatchedPublished: string[]
}

export function getPackageExportSideEffects(
  packageJson: unknown,
  exportPath: string,
): PackageExportSideEffects {
  if (!isRecord(packageJson)) return { published: true, source: true }

  let sourceExport = getExportConfig(packageJson.exports, exportPath)
  let publishConfig = isRecord(packageJson.publishConfig) ? packageJson.publishConfig : null
  let publishedExports = publishConfig?.exports ?? packageJson.exports
  let publishedExport = getExportConfig(publishedExports, exportPath)

  return {
    published: exportHasSideEffects(publishedExport, packageJson.sideEffects),
    source: exportHasSideEffects(sourceExport, packageJson.sideEffects),
  }
}

export function getSideEffectPatternPairingIssues(
  patterns: readonly string[],
): SideEffectPatternPairingIssues {
  let sourcePatterns = patterns.filter((pattern) => normalizePath(pattern).startsWith('src/'))
  let publishedPatterns = patterns.filter((pattern) => normalizePath(pattern).startsWith('dist/'))
  let normalizedPublishedPatterns = new Set(publishedPatterns.map(normalizePath))
  let expectedPublishedPatterns = new Set<string>()
  let missingPublished: SideEffectPatternPairingIssues['missingPublished'] = []
  let unsupportedPatterns = [...sourcePatterns, ...publishedPatterns].filter(hasGlobSyntax)

  for (let source of sourcePatterns.filter((pattern) => !hasGlobSyntax(pattern))) {
    let expectedPublished = getPublishedPattern(source)
    expectedPublishedPatterns.add(normalizePath(expectedPublished))
    if (!normalizedPublishedPatterns.has(normalizePath(expectedPublished))) {
      missingPublished.push({ source, expectedPublished })
    }
  }

  return {
    missingPublished,
    unsupportedPatterns,
    unmatchedPublished: publishedPatterns.filter(
      (pattern) =>
        !hasGlobSyntax(pattern) && !expectedPublishedPatterns.has(normalizePath(pattern)),
    ),
  }
}

function hasGlobSyntax(pattern: string): boolean {
  return picomatch.scan(pattern).isGlob
}

function getPublishedPattern(sourcePattern: string): string {
  let hasRelativePrefix = sourcePattern.startsWith('./')
  let publishedPattern = normalizePath(sourcePattern)
    .replace(/^src\//, 'dist/')
    .replace(/\.tsx?$/, '.js')
    .replace(/\.mts$/, '.mjs')
    .replace(/\.cts$/, '.cjs')

  return hasRelativePrefix ? `./${publishedPattern}` : publishedPattern
}

function getExportConfig(exportsConfig: unknown, exportPath: string): unknown {
  return isRecord(exportsConfig) ? exportsConfig[exportPath] : undefined
}

function exportHasSideEffects(exportConfig: unknown, sideEffects: unknown): boolean {
  let targets = getRuntimeExportTargets(exportConfig)
  if (targets.length === 0) return !isTypeOnlyExportConfig(exportConfig)
  if (sideEffects === false) return false
  if (!Array.isArray(sideEffects)) return true
  if (!sideEffects.every((pattern): pattern is string => typeof pattern === 'string')) return true

  return targets.some((target) => sideEffects.some((pattern) => matchesPattern(target, pattern)))
}

function isTypeOnlyExportConfig(exportConfig: unknown): boolean {
  if (!isRecord(exportConfig)) return false
  let entries = Object.entries(exportConfig)
  return entries.length > 0 && entries.every(([condition]) => condition === 'types')
}

function getRuntimeExportTargets(exportConfig: unknown): string[] {
  if (typeof exportConfig === 'string') return [exportConfig]
  if (!isRecord(exportConfig)) return []

  return Object.entries(exportConfig).flatMap(([condition, target]) =>
    condition === 'types' ? [] : getRuntimeExportTargets(target),
  )
}

function matchesPattern(filePath: string, pattern: string): boolean {
  let normalizedPath = normalizePath(filePath)
  let normalizedPattern = normalizePath(pattern)
  let packageRelativePattern = pattern.replaceAll('\\', '/')

  try {
    return picomatch.isMatch(normalizedPath, normalizedPattern, {
      basename: !packageRelativePattern.includes('/'),
      dot: true,
    })
  } catch {
    return true
  }
}

function normalizePath(value: string): string {
  let normalized = value.replaceAll('\\', '/')
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
