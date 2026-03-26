import * as os from 'node:os'
import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import * as util from 'node:util'
import { tsImport } from 'tsx/esm/api'
import type { PlaywrightTestConfig } from 'playwright/test'

export const defaultTestGlob = '**/*.test?(.browser)?(.e2e).{ts,tsx}'

const cliOptions = {
  'browser.echo': { type: 'boolean' },
  'browser.open': { type: 'boolean' },
  'browser.port': { type: 'string', short: 'p' },
  'glob.browser': { type: 'string' },
  'glob.e2e': { type: 'string' },
  'glob.test': { type: 'string' },
  concurrency: { type: 'string', short: 'c' },
  config: { type: 'string' },
  coverage: { type: 'boolean' },
  'coverage.dir': { type: 'string' },
  'coverage.include': { type: 'string', multiple: true },
  'coverage.exclude': { type: 'string', multiple: true },
  'coverage.statements': { type: 'string' },
  'coverage.lines': { type: 'string' },
  'coverage.branches': { type: 'string' },
  'coverage.functions': { type: 'string' },
  setup: { type: 'string' },
  playwrightConfig: { type: 'string' },
  project: { type: 'string' },
  reporter: { type: 'string', short: 'r' },
  type: { type: 'string', short: 't' },
  watch: { type: 'boolean', short: 'w' },
} as const

export interface RemixTestConfig {
  browser?: {
    /** Log browser console output to stdout (--browser.echo) */
    echo?: boolean
    /** Open browser window during tests (--browser.open) */
    open?: boolean
    /** Port for the browser test server (--browser.port) */
    port?: number | string
  }
  glob?: {
    /** Glob pattern for all test files (--glob.test) */
    test?: string
    /** Glob pattern for browser test files (--glob.browser) */
    browser?: string
    /** Glob pattern for e2e test files (--glob.e2e) */
    e2e?: string
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
        dir?: string
        include?: string[]
        exclude?: string[]
        statements?: number | string
        lines?: number | string
        branches?: number | string
        functions?: number | string
      }
  /**
   * Path to a module that exports `setup` and/or `teardown` functions,
   * called once before and after the test run respectively. (--setup)
   */
  setup?: string
  /**
   * Playwright configuration — either a path to a playwright config file or an inline
   * PlaywrightTestConfig object. CLI `--playwrightConfig` only accepts a file path.
   */
  playwrightConfig?: string | PlaywrightTestConfig
  /** Filter tests to a specific playwright project (--project) */
  project?: string
  /** Test reporter (--reporter) */
  reporter?: string
  /** Comma-separated list of test types to run: server,browser,e2e (--type) */
  type?: string
  /** Watch mode — re-run tests on file changes (--watch) */
  watch?: boolean
}

export interface ResolvedRemixTestConfig {
  browser: {
    echo?: boolean
    open?: boolean
    port: number
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
    test: string
    browser: string
    e2e: string
  }
  setup?: string
  playwrightConfig?: string | PlaywrightTestConfig
  project?: string
  reporter: string
  type: string
  watch?: boolean
}

export async function loadConfig() {
  let parsed = parseCliArgs()
  let fileConfig = await loadConfigFile(parsed.values.config)
  let config = resolveConfig(fileConfig, parsed)
  return config
}

function parseCliArgs(args = process.argv.slice(2)) {
  return util.parseArgs({ args, options: cliOptions, allowPositionals: true })
}

function resolveConfig(
  fileConfig: RemixTestConfig,
  { values: cliValues, positionals }: ReturnType<typeof parseCliArgs>,
): ResolvedRemixTestConfig {
  let fileCoverage = fileConfig.coverage
  let fileCoverageSettings = typeof fileCoverage === 'object' ? fileCoverage : {}

  let coverageEnabled =
    cliValues.coverage ??
    (cliValues['coverage.dir'] !== undefined ||
    cliValues['coverage.include'] !== undefined ||
    cliValues['coverage.exclude'] !== undefined ||
    cliValues['coverage.statements'] !== undefined ||
    cliValues['coverage.lines'] !== undefined ||
    cliValues['coverage.branches'] !== undefined ||
    cliValues['coverage.functions'] !== undefined
      ? true
      : fileCoverage !== undefined && fileCoverage !== false
        ? Boolean(fileCoverage)
        : false)

  return {
    glob: {
      test: positionals[0] ?? cliValues['glob.test'] ?? fileConfig.glob?.test ?? defaultTestGlob,
      browser:
        cliValues['glob.browser'] ?? fileConfig.glob?.browser ?? '**/*.test.browser.{ts,tsx}',
      e2e: cliValues['glob.e2e'] ?? fileConfig.glob?.e2e ?? '**/*.test.e2e.{ts,tsx}',
    },
    browser: {
      echo: cliValues['browser.echo'] ?? fileConfig.browser?.echo,
      open: cliValues['browser.open'] ?? fileConfig.browser?.open,
      port: Number(cliValues['browser.port'] ?? fileConfig.browser?.port ?? 44101),
    },
    concurrency: Number(
      cliValues.concurrency ?? fileConfig.concurrency ?? os.availableParallelism(),
    ),
    coverage: coverageEnabled
      ? {
          dir: cliValues['coverage.dir'] ?? fileCoverageSettings.dir ?? '.coverage',
          include: cliValues['coverage.include'] ?? fileCoverageSettings.include,
          exclude: cliValues['coverage.exclude'] ?? fileCoverageSettings.exclude,
          statements:
            cliValues['coverage.statements'] !== undefined
              ? Number(cliValues['coverage.statements'])
              : fileCoverageSettings.statements !== undefined
                ? Number(fileCoverageSettings.statements)
                : undefined,
          lines:
            cliValues['coverage.lines'] !== undefined
              ? Number(cliValues['coverage.lines'])
              : fileCoverageSettings.lines !== undefined
                ? Number(fileCoverageSettings.lines)
                : undefined,
          branches:
            cliValues['coverage.branches'] !== undefined
              ? Number(cliValues['coverage.branches'])
              : fileCoverageSettings.branches !== undefined
                ? Number(fileCoverageSettings.branches)
                : undefined,
          functions:
            cliValues['coverage.functions'] !== undefined
              ? Number(cliValues['coverage.functions'])
              : fileCoverageSettings.functions !== undefined
                ? Number(fileCoverageSettings.functions)
                : undefined,
        }
      : undefined,
    setup: cliValues.setup ?? fileConfig.setup,
    playwrightConfig: cliValues.playwrightConfig ?? fileConfig.playwrightConfig,
    project: cliValues.project ?? fileConfig.project,
    reporter: cliValues.reporter ?? fileConfig.reporter ?? 'spec',
    type: cliValues.type ?? fileConfig.type ?? 'server,browser,e2e',
    watch: cliValues.watch ?? fileConfig.watch,
  }
}

async function loadConfigFile(configPath?: string): Promise<RemixTestConfig> {
  let candidates = configPath
    ? [path.resolve(process.cwd(), configPath)]
    : [
        path.join(process.cwd(), 'remix-test.config.ts'),
        path.join(process.cwd(), 'remix-test.config.js'),
      ]

  for (let candidate of candidates) {
    try {
      await fsp.access(candidate)
      let mod = await tsImport(candidate, { parentURL: import.meta.url })
      return mod.default ?? mod
    } catch {
      // not found or failed to load — try next
    }
  }

  return {}
}
