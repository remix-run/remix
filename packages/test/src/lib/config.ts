import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PlaywrightTestConfig } from 'playwright/test'

export const IS_RUNNING_FROM_SRC = path.extname(new URL(import.meta.url).pathname) === '.ts'

/*
 * The root directory for the test code. Coverage URLs are emitted as
 * `/scripts/<rel-from-rootDir>` and resolved back via the same anchor.
 *
 *   - In a published install: `process.cwd()`, since deps and user source all
 *     live under it.
 *   - In monorepo src mode: the monorepo root, computed by walking back from
 *     the resolved `@remix-run/test` source path. `process.cwd()` doesn't work
 *     here because workspace deps and node_modules live above the per-package
 *     cwd.
 */
export function getBrowserTestRootDir(): string {
  return IS_RUNNING_FROM_SRC
    ? // Resolve to packages/test/src/index.ts and the pop 3 directories off to the repo root
      path
        .dirname(fileURLToPath(import.meta.resolve('@remix-run/test')))
        .split(path.sep)
        .slice(0, -3)
        .join(path.sep)
    : process.cwd()
}

const defaultValues: ResolvedRemixTestConfig = {
  browser: {
    echo: false,
    open: false,
  },
  concurrency: os.availableParallelism(),
  coverage: {
    dir: '.coverage',
    include: undefined,
    exclude: undefined,
    statements: undefined,
    lines: undefined,
    branches: undefined,
    functions: undefined,
  },
  glob: {
    test: ['**/*.test{,.e2e,.browser}.{ts,tsx}'],
    browser: ['**/*.test.browser.{ts,tsx}'],
    e2e: ['**/*.test.e2e.{ts,tsx}'],
    exclude: ['node_modules/**'],
  },
  pool: 'forks',
  only: undefined,
  playwrightConfig: undefined,
  project: undefined,
  quiet: false,
  reporter: process.env.CI === 'true' ? 'files' : 'spec',
  setup: undefined,
  type: ['server', 'browser', 'e2e'],
  watch: false,
}

/**
 * Worker pools supported by the Remix test runner.
 */
export const remixTestPools = ['forks', 'threads'] as const

/**
 * Worker pool used by Remix to run server and E2E test files.
 * `'forks'` (default) uses child processes for stronger isolation; `'threads'`
 * uses worker threads for projects that prefer lower-overhead startup.
 */
export type RemixTestPool = (typeof remixTestPools)[number]

export interface SerializedOnlyPattern {
  source: string
  flags: string
}

export type RemixTestOnlyPattern = string | RegExp

/**
 * User-facing configuration for the Remix test runner. Every field is optional, and unset fields
 * fall back to runner defaults. Pass this shape to `runRemixTest()`.
 */
export interface RemixTestConfig {
  /**
   * Options for controlling Playwright browsers.
   */
  browser?: {
    /** Echo browser console output to stdout. */
    echo?: boolean
    /** Open a browser window and keep it open after tests finish. */
    open?: boolean
  }
  /**
   * Glob patterns to identify test files. Each field accepts a single pattern
   * or an array of patterns; arrays are unioned during discovery.
   *  - `glob.test`: Glob pattern(s) for all test files (--glob.test)
   *  - `glob.browser`: Glob pattern(s) for the subset of browser test files (--glob.browser)
   *  - `glob.e2e`: Glob pattern(s) for the subset of e2e test files (--glob.e2e)
   *  - `glob.exclude`: Glob pattern(s) for paths to exclude from discovery (--glob.exclude)
   */
  glob?: {
    /** Glob patterns for all test files. */
    test?: string | string[]
    /** Glob patterns for the subset of browser test files. */
    browser?: string | string[]
    /** Glob patterns for the subset of E2E test files. */
    e2e?: string | string[]
    /** Glob patterns excluded from test discovery. */
    exclude?: string | string[]
  }
  /** Max number of concurrent test workers (--concurrency) */
  concurrency?: number | string
  /**
   * Coverage configuration. `true` enables with defaults; an object enables with settings;
   * `false` disables. CLI `--coverage` flag overrides the boolean aspect.
   */
  coverage?:
    | boolean
    | {
        /**
         * Enables or disables coverage when specified. A coverage object enables coverage by
         * default. `'inherit'` applies settings without enabling coverage.
         */
        enabled?: boolean | 'inherit'
        /** Directory where coverage reports are written. */
        dir?: string
        /** Glob patterns for files included in coverage. */
        include?: string | string[]
        /** Glob patterns for files excluded from coverage. */
        exclude?: string | string[]
        /** Minimum statement coverage percentage. */
        statements?: number | string
        /** Minimum line coverage percentage. */
        lines?: number | string
        /** Minimum branch coverage percentage. */
        branches?: number | string
        /** Minimum function coverage percentage. */
        functions?: number | string
      }
  /**
   * Path to a module that exports `globalSetup` and/or `globalTeardown` functions,
   * called once before and after the test run respectively. (--setup)
   */
  setup?: string
  /**
   * Playwright configuration — either a path to a playwright config file or an inline
   * PlaywrightTestConfig object. CLI `--playwrightConfig` only accepts a file path.
   */
  playwrightConfig?: string | PlaywrightTestConfig
  /**
   * Pool used to run server and E2E test files. Forked child processes are the default,
   * but worker threads are available for projects that prefer the previous behavior.
   */
  pool?: RemixTestPool
  /**
   * Regular expression pattern(s) to focus tests by their full name (--only).
   * Matching suite names focus the whole suite, while matching test names focus
   * the individual test. Plain string patterns are case-insensitive. Use a
   * slash-delimited pattern or a `RegExp` in programmatic options to control flags
   * explicitly. `--only` may be repeated on the CLI.
   */
  only?: RemixTestOnlyPattern | RemixTestOnlyPattern[]
  /**
   * Filter tests to specific playwright project(s) (--project). Accepts a single
   * project name or an array of names; `--project` may be repeated on the CLI.
   */
  project?: string | string[]
  /** Quiet mode — do not print skipped tests (--quiet, -q) */
  quiet?: boolean
  /** Test reporter (--reporter) */
  reporter?: string
  /**
   * Test type(s) to run (--type). Accepts a single type or an array of types;
   * `--type` may be repeated on the CLI. Valid values: "server", "browser", "e2e".
   */
  type?: string | string[]
  /** Watch mode — re-run tests on file changes (--watch) */
  watch?: boolean
}

export interface ResolvedRemixTestConfig {
  browser: {
    echo?: boolean
    open?: boolean
  }
  concurrency: number
  coverage:
    | {
        dir: string
        include?: string[]
        exclude?: string[]
        statements?: number
        lines?: number
        branches?: number
        functions?: number
      }
    | undefined
  glob: {
    test: string[]
    browser: string[]
    e2e: string[]
    exclude: string[]
  }
  playwrightConfig: string | PlaywrightTestConfig | undefined
  project: string[] | undefined
  quiet: boolean
  reporter: string
  pool: RemixTestPool
  only: SerializedOnlyPattern[] | undefined
  setup: string | undefined
  type: string[]
  watch: boolean
}

export function resolveConfig(config: RemixTestConfig = {}): ResolvedRemixTestConfig {
  let coverageOptions = typeof config.coverage === 'boolean' ? {} : config.coverage || {}
  let coverageEnabled = isCoverageEnabled(config.coverage)

  return {
    glob: {
      test: toArray(config.glob?.test ?? defaultValues.glob.test),
      browser: toArray(config.glob?.browser ?? defaultValues.glob.browser),
      e2e: toArray(config.glob?.e2e ?? defaultValues.glob.e2e),
      exclude: toArray(config.glob?.exclude ?? defaultValues.glob.exclude),
    },
    browser: {
      echo: config.browser?.echo ?? defaultValues.browser.echo,
      open: config.browser?.open ?? defaultValues.browser.open,
    },
    concurrency: resolveConcurrency(config.concurrency ?? defaultValues.concurrency),
    coverage: coverageEnabled
      ? {
          dir: coverageOptions.dir ?? defaultValues.coverage!.dir,
          include: optionalArray(coverageOptions.include ?? defaultValues.coverage!.include),
          exclude: optionalArray(coverageOptions.exclude ?? defaultValues.coverage!.exclude),
          statements: optionalNumber(coverageOptions.statements, 'coverage.statements'),
          lines: optionalNumber(coverageOptions.lines, 'coverage.lines'),
          branches: optionalNumber(coverageOptions.branches, 'coverage.branches'),
          functions: optionalNumber(coverageOptions.functions, 'coverage.functions'),
        }
      : undefined,
    setup: config.setup ?? defaultValues.setup,
    playwrightConfig: config.playwrightConfig ?? defaultValues.playwrightConfig,
    pool: resolvePool(config.pool ?? defaultValues.pool),
    only: resolveOnlyPatterns(config.only),
    project: (() => {
      let raw = config.project ?? defaultValues.project
      return raw === undefined ? undefined : toCommaSeparatedArray(raw)
    })(),
    quiet: config.quiet ?? defaultValues.quiet,
    reporter: config.reporter ?? defaultValues.reporter,
    type: toCommaSeparatedArray(config.type ?? defaultValues.type),
    watch: config.watch ?? defaultValues.watch,
  }
}

function toArray<T>(value: T | readonly T[]): T[] {
  return Array.isArray(value) ? [...value] : [value as T]
}

function toCommaSeparatedArray(value: string | readonly string[]): string[] {
  return toArray(value).flatMap((item) =>
    item
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

function optionalArray<value>(input: value | readonly value[] | undefined): value[] | undefined {
  return input === undefined ? undefined : toArray(input)
}

function optionalNumber(input: number | string | undefined, name: string): number | undefined {
  if (input === undefined) return undefined

  let value = Number(input)
  if (Number.isNaN(value)) {
    throw new Error(`Invalid ${name} value "${input}". Expected a number`)
  }

  return value
}

function resolveConcurrency(value: number | string): number {
  let concurrency = Number(value)
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`Invalid concurrency value "${value}". Expected a positive integer`)
  }

  return concurrency
}

function isCoverageEnabled(coverage: RemixTestConfig['coverage']): boolean {
  if (typeof coverage === 'boolean') return coverage
  return coverage != null && coverage.enabled !== false && coverage.enabled !== 'inherit'
}

function resolvePool(value: string): RemixTestPool {
  if ((remixTestPools as readonly string[]).includes(value)) {
    return value as RemixTestPool
  }

  throw new Error(
    `Unsupported test pool "${value}". Supported pools are: ${remixTestPools.join(', ')}`,
  )
}

function resolveOnlyPatterns(
  value: RemixTestOnlyPattern | readonly RemixTestOnlyPattern[] | undefined,
): SerializedOnlyPattern[] | undefined {
  if (value === undefined) return undefined

  return toArray(value).map((pattern) => {
    let serialized: SerializedOnlyPattern
    if (typeof pattern === 'string') {
      serialized = parseRegexLiteral(pattern) ?? { source: pattern, flags: 'i' }
    } else {
      serialized = { source: pattern.source, flags: pattern.flags }
    }

    try {
      new RegExp(serialized.source, serialized.flags)
    } catch (error) {
      let reason = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Invalid --only pattern "${pattern}". ` +
          `--only patterns must be valid JavaScript regular expressions, ` +
          `or regex literals like "/pattern/flags". ${reason}`,
      )
    }

    return serialized
  })
}

function parseRegexLiteral(pattern: string): SerializedOnlyPattern | undefined {
  if (!pattern.startsWith('/') || pattern.length < 2) return undefined

  // The closing delimiter is the last unescaped slash; escape state must be
  // tracked left-to-right since it depends on the preceding backslashes.
  let closingIndex = -1
  let escaped = false
  for (let index = 1; index < pattern.length; index++) {
    if (escaped) {
      escaped = false
    } else if (pattern[index] === '\\') {
      escaped = true
    } else if (pattern[index] === '/') {
      closingIndex = index
    }
  }

  if (closingIndex === -1) return undefined

  return {
    source: pattern.slice(1, closingIndex),
    flags: pattern.slice(closingIndex + 1),
  }
}
