import * as mod from 'node:module'
import { IS_RUNNING_FROM_SRC } from './config.ts'
import { importModule } from './import-module.ts'
import type { SerializedTestNamePattern } from './config.ts'
import type { CoverageConfig } from './coverage.ts'
import type { TestResults } from './reporters/results.ts'
import { runTests } from './executor.ts'
import { IS_BUN } from './runtime.ts'
import { createFailedResults } from './worker-results.ts'

export interface ServerTestWorkerData {
  file: string
  coverage?: CoverageConfig
  testNamePatterns?: SerializedTestNamePattern[]
}

export async function runServerTestFile(value: unknown): Promise<TestResults> {
  let workerData: ServerTestWorkerData | undefined

  try {
    workerData = parseServerTestWorkerData(value)

    // When coverage is enabled in Node, we use a coverage-friendly TypeScript loader with
    // an un-minified esbuild transform so V8 coverage byte offsets align with readable
    // source lines.
    if (workerData.coverage && !IS_BUN) {
      // Ensure we load the right file whether we're running in the monorepo (TS) or
      // from a published package (JS)
      let ext = IS_RUNNING_FROM_SRC ? '.ts' : '.js'
      mod.register(new URL(`./coverage-loader${ext}`, import.meta.url), import.meta.url)
      await import(workerData.file)
    } else {
      await importModule(workerData.file, import.meta)
    }

    let results = await runTests({ testNamePatterns: workerData.testNamePatterns })
    await takeCoverage(workerData.coverage)
    return results
  } catch (error) {
    let failure = error

    try {
      await takeCoverage(workerData?.coverage)
    } catch (coverageError) {
      failure = coverageError
    }

    return createFailedResults(failure)
  }
}

function parseServerTestWorkerData(value: unknown): ServerTestWorkerData {
  if (!isRecord(value) || typeof value.file !== 'string') {
    throw new Error('Invalid server test worker data')
  }

  return {
    file: value.file,
    coverage: parseCoverageConfig(value.coverage),
    testNamePatterns: parseTestNamePatterns(value.testNamePatterns),
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseCoverageConfig(value: unknown): CoverageConfig | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!isRecord(value) || typeof value.dir !== 'string') {
    throw new Error('Invalid server test worker coverage config')
  }

  let coverage: CoverageConfig = {
    dir: value.dir,
  }
  let include = parseStringArray(value.include, 'include')
  let exclude = parseStringArray(value.exclude, 'exclude')
  let statements = parseNumber(value.statements, 'statements')
  let lines = parseNumber(value.lines, 'lines')
  let branches = parseNumber(value.branches, 'branches')
  let functions = parseNumber(value.functions, 'functions')

  if (include) coverage.include = include
  if (exclude) coverage.exclude = exclude
  if (statements !== undefined) coverage.statements = statements
  if (lines !== undefined) coverage.lines = lines
  if (branches !== undefined) coverage.branches = branches
  if (functions !== undefined) coverage.functions = functions

  return coverage
}

export function parseTestNamePatterns(value: unknown): SerializedTestNamePattern[] | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    throw new Error('Invalid server test worker test name patterns')
  }

  return value.map((item) => {
    if (!isRecord(item) || typeof item.source !== 'string' || typeof item.flags !== 'string') {
      throw new Error('Invalid server test worker test name pattern')
    }

    new RegExp(item.source, item.flags)
    return { source: item.source, flags: item.flags }
  })
}

function parseStringArray(value: unknown, name: string): string[] | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Invalid server test worker coverage ${name}`)
  }

  return value
}

function parseNumber(value: unknown, name: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'number') {
    throw new Error(`Invalid server test worker coverage ${name}`)
  }

  return value
}

async function takeCoverage(coverage: CoverageConfig | undefined): Promise<void> {
  if (coverage && !IS_BUN) {
    let v8 = await import('node:v8')
    v8.takeCoverage()
  }
}
