import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import type { createCoverageMap as CreateCoverageMap } from 'istanbul-lib-coverage'
import type { createContext as CreateContext } from 'istanbul-lib-report'
import type IstanbulReports from 'istanbul-reports'
import { colors } from './utils.ts'
import { transformTypeScript } from './ts-transform.ts'

// Istanbul packages are loaded lazily so that FORCE_COLOR can be set based on
// the actual TTY state before supports-color caches its detection result.
let _istanbul:
  | {
      V8ToIstanbul: any
      createCoverageMap: typeof CreateCoverageMap
      createContext: typeof CreateContext
      reports: typeof IstanbulReports
    }
  | undefined

function getIstanbul() {
  if (!_istanbul) {
    process.env.FORCE_COLOR ??= process.stdout.isTTY ? '1' : '0'
    let require = createRequire(import.meta.url)
    _istanbul = {
      V8ToIstanbul: require('v8-to-istanbul'),
      createCoverageMap: (
        require('istanbul-lib-coverage') as { createCoverageMap: typeof CreateCoverageMap }
      ).createCoverageMap,
      createContext: (require('istanbul-lib-report') as { createContext: typeof CreateContext })
        .createContext,
      reports: require('istanbul-reports') as typeof IstanbulReports,
    }
  }
  return _istanbul
}

export interface CoverageConfig {
  dir: string
  include?: string[]
  exclude?: string[]
  statements?: number
  lines?: number
  branches?: number
  functions?: number
}

export interface V8CoverageEntry {
  url: string
  source?: string
  functions: Array<{
    functionName: string
    isBlockCoverage: boolean
    ranges: Array<{ startOffset: number; endOffset: number; count: number }>
  }>
}

export type CoverageMap = ReturnType<typeof CreateCoverageMap>

function matchesGlobs(filePath: string, globs: string[]): boolean {
  return globs.some((glob) => path.matchesGlob(filePath, glob))
}

function filterCoverageMap(
  coverageMap: CoverageMap,
  cwd: string,
  config: CoverageConfig,
): CoverageMap {
  let filtered = getIstanbul().createCoverageMap({})
  for (let filePath of coverageMap.files()) {
    // Browser coverage entries are keyed as /scripts/@test/<relative> (the dev server path),
    // not the real filesystem path, so path.relative would produce a ../../.. mess.
    let scriptTestPrefix = '/scripts/@test/'
    let idx = filePath.indexOf(scriptTestPrefix)
    let relative =
      idx >= 0 ? filePath.slice(idx + scriptTestPrefix.length) : path.relative(cwd, filePath)

    if (config.include && config.include.length > 0) {
      if (!matchesGlobs(relative, config.include)) continue
    }
    if (config.exclude && config.exclude.length > 0) {
      if (matchesGlobs(relative, config.exclude)) continue
    }
    let fc = coverageMap.fileCoverageFor(filePath) as any
    filtered.addFileCoverage({ ...fc.toJSON(), path: relative })
  }
  return filtered
}

function checkThresholds(coverageMap: CoverageMap, config: CoverageConfig): boolean {
  let { statements, lines, branches, functions } = config
  if (
    statements === undefined &&
    lines === undefined &&
    branches === undefined &&
    functions === undefined
  )
    return true

  let summary = coverageMap.getCoverageSummary()
  let passed = true

  if (statements !== undefined) {
    let pct = summary.statements.pct
    if (pct < statements) {
      console.error(
        colors.red(
          `\nError: Coverage threshold not met (statements ${pct.toFixed(2)}% < ${statements}%)`,
        ),
      )
      passed = false
    }
  }
  if (lines !== undefined) {
    let pct = summary.lines.pct
    if (pct < lines) {
      console.error(
        colors.red(`\nError: Coverage threshold not met (lines ${pct.toFixed(2)}% < ${lines}%)`),
      )
      passed = false
    }
  }
  if (branches !== undefined) {
    let pct = summary.branches.pct
    if (pct < branches) {
      console.error(
        colors.red(
          `\nError: Coverage threshold not met (branches ${pct.toFixed(2)}% < ${branches}%)`,
        ),
      )
      passed = false
    }
  }
  if (functions !== undefined) {
    let pct = summary.functions.pct
    if (pct < functions) {
      console.error(
        colors.red(
          `\nError: Coverage threshold not met (functions ${pct.toFixed(2)}% < ${functions}%)`,
        ),
      )
      passed = false
    }
  }

  return passed
}

async function writeIstanbulReports(coverageMap: CoverageMap, cwd: string, outDir: string) {
  await fsp.mkdir(outDir, { recursive: true })
  let { createContext, reports } = getIstanbul()
  let ctx = createContext({ coverageMap, dir: outDir } as any)
  console.log('\nCoverage report:')
  reports.create('text').execute(ctx)
  reports.create('lcovonly').execute(ctx)
  console.log(`\nLCOV coverage written to ${path.relative(cwd, path.join(outDir, 'lcov.info'))}`)
}

// Convert a single V8 coverage entry to Istanbul format and merge it into the
// coverage map. Both server and E2E collection use this shared path so the
// esbuild re-transform and source-map options stay in sync.
async function addV8EntryToCoverageMap(
  coverageMap: CoverageMap,
  filePath: string,
  functions: V8CoverageEntry['functions'],
): Promise<boolean> {
  let { V8ToIstanbul } = getIstanbul()

  // When our coverage-loader (server) or test handler (E2E) transforms
  // TypeScript, V8 tracks coverage using byte offsets from the transformed JS.
  // Re-transform with the same esbuild options so offsets align, then pass the
  // result with its inline source map to v8-to-istanbul.
  let sources: { source: string } | undefined
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let tsSource = await fsp.readFile(filePath, 'utf-8')
    let { code } = await transformTypeScript(tsSource, filePath)
    sources = { source: code }
  }
  let converter = new V8ToIstanbul(filePath, undefined, sources)
  await converter.load()
  converter.applyCoverage(functions)
  coverageMap.merge(converter.toIstanbul())
  return true
}

// Resolve a V8 coverage entry URL to an absolute file path, or null if it
// should be skipped (node_modules, test files, outside cwd, etc.).
function resolveServerEntryPath(url: string, cwd: string, testFiles: Set<string>): string | null {
  if (!url.startsWith('file://')) return null

  let filePath: string
  try {
    filePath = fileURLToPath(url)
  } catch {
    return null
  }

  if (!filePath.startsWith(cwd + path.sep)) return null
  if (filePath.includes(`${path.sep}node_modules${path.sep}`)) return null
  if (testFiles.has(filePath)) return null
  return filePath
}

// Resolve a browser coverage entry URL (http://host:port/path) to an absolute
// file path, or null if it should be skipped.
async function resolveE2EEntryPath(
  url: string,
  cwd: string,
  testFiles: Set<string>,
): Promise<string | null> {
  let urlPath: string
  try {
    urlPath = new URL(url).pathname
  } catch {
    return null
  }

  let relative = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath
  if (!relative) return null

  let filePath = path.resolve(cwd, relative)
  if (!filePath.startsWith(cwd + path.sep)) return null
  if (filePath.includes(`${path.sep}node_modules${path.sep}`)) return null
  if (testFiles.has(filePath)) return null

  try {
    await fsp.access(filePath)
  } catch {
    return null
  }

  return filePath
}

export async function collectServerCoverageMap(
  coverageDataDir: string,
  cwd: string,
  testFiles: Set<string>,
): Promise<CoverageMap | null> {
  let { createCoverageMap } = getIstanbul()
  let coverageMap = createCoverageMap({})
  let converted = 0

  let files: string[]
  try {
    files = (await fsp.readdir(coverageDataDir)).filter(
      (f) => f.startsWith('coverage-') && f.endsWith('.json'),
    )
  } catch {
    return null
  }

  for (let file of files) {
    let data = JSON.parse(await fsp.readFile(path.join(coverageDataDir, file), 'utf-8'))
    let scriptCoverages: Array<{ url: string; functions: any[] }> = data.result ?? []

    for (let entry of scriptCoverages) {
      let filePath = resolveServerEntryPath(entry.url, cwd, testFiles)
      if (!filePath) continue

      try {
        if (await addV8EntryToCoverageMap(coverageMap, filePath, entry.functions)) converted++
      } catch {
        // Skip files that can't be converted
      }
    }
  }

  // Clean up raw V8 coverage JSON files now that we've processed them
  await Promise.all(files.map((f) => fsp.rm(path.join(coverageDataDir, f), { force: true })))

  return converted > 0 ? coverageMap : null
}

export async function collectE2ECoverageMap(
  browserEntries: Array<{ entries: V8CoverageEntry[]; baseUrl: string }>,
  cwd: string,
  testFiles: Set<string>,
): Promise<CoverageMap | null> {
  let { createCoverageMap } = getIstanbul()
  let coverageMap = createCoverageMap({})
  let converted = 0

  for (let { entries } of browserEntries) {
    for (let entry of entries) {
      let filePath = await resolveE2EEntryPath(entry.url, cwd, testFiles)
      if (!filePath) continue

      try {
        if (await addV8EntryToCoverageMap(coverageMap, filePath, entry.functions)) converted++
      } catch {
        // Skip files that can't be converted
      }
    }
  }

  return converted > 0 ? coverageMap : null
}

export async function generateCombinedCoverageReport(
  maps: (CoverageMap | null | undefined)[],
  cwd: string,
  config: CoverageConfig,
): Promise<boolean> {
  let { createCoverageMap } = getIstanbul()
  let combined = createCoverageMap({})
  for (let map of maps) {
    if (map) combined.merge(map)
  }

  if (combined.files().length === 0) {
    console.log('No coverage data collected.')
    return true
  }

  let filtered = filterCoverageMap(combined, cwd, config)
  await writeIstanbulReports(filtered, cwd, config.dir)
  return checkThresholds(filtered, config)
}
