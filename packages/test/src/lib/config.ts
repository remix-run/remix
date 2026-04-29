import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as util from 'node:util'
import type { PlaywrightTestConfig } from 'playwright/test'
import { importModule } from './import-module.ts'

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

// prettier-ignore
// Note: `description` is not a field used by parseArgs(), it's an additional field
// we use for `--help`
const cliOptions = {
  'browser.echo': {
    type: 'boolean',
    description: 'Echo browser console output to stdout',
  },
  'browser.open': {
    type: 'boolean',
    description: 'Open browser window and keep open after tests finish',
  },
  'glob.browser': {
    type: 'string',
    multiple: true,
    description: 'Glob pattern(s) for browser test files',
  },
  'glob.e2e': {
    type: 'string',
    multiple: true,
    description: 'Glob pattern(s) for E2E test files',
  },
  'glob.exclude': {
    type: 'string',
    multiple: true,
    description: 'Glob pattern(s) for paths to exclude from discovery',
  },
  'glob.test': {
    type: 'string',
    multiple: true,
    description: 'Glob pattern(s) for all test files',
  },
  concurrency: {
    type: 'string',
    short: 'c',
    description: 'Max number of concurrent test workers (default: os.availableParallelism())',
  },
  config: {
    type: 'string',
    description: 'Path to config file (default: remix-test.config.ts)',
  },
  coverage: {
    type: 'boolean',
    description: 'Enable or disable coverage collection (default: false)',
  },
  'coverage.dir': {
    type: 'string',
    description: 'Directory to output coverage reports (default: .coverage)',
  },
  'coverage.include': {
    type: 'string',
    multiple: true,
    description: 'Glob pattern(s) for files to include in coverage',
  },
  'coverage.exclude': {
    type: 'string',
    multiple: true,
    description: 'Glob pattern(s) for files to exclude from coverage',
  },
  'coverage.branches': {
    type: 'string',
    description: 'Branches coverage threshold percentage',
  },
  'coverage.functions': {
    type: 'string',
    description: 'Functions coverage threshold percentage',
  },
  'coverage.lines': {
    type: 'string',
    description: 'Lines coverage threshold percentage',
  },
  'coverage.statements': {
    type: 'string',
    description: 'Statements coverage threshold percentage',
  },
  setup: {
    type: 'string',
    short: 's',
    description: 'Path to a setup module exporting globalSetup/globalTeardown',
  },
  playwrightConfig: {
    type: 'string',
    description: 'Path to a Playwright config file',
  },
  project: {
    type: 'string',
    short: 'p',
    multiple: true,
    description: 'Filter to specific Playwright project(s)',
  },
  reporter: {
    type: 'string',
    short: 'r',
    description: 'Test reporter: spec, files, tap, dot (default: spec)',
  },
  type: {
    type: 'string',
    short: 't',
    multiple: true,
    description: 'Test types to run (default: server, browser, e2e)',
  },
  watch: {
    type: 'boolean',
    short: 'w',
    description: 'Re-run tests on file changes',
  },
} as const

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
  reporter: process.env.CI === 'true' ? 'files' : 'spec',
  type: ['server', 'browser', 'e2e'],
  setup: undefined,
  playwrightConfig: undefined,
  project: undefined,
  watch: false,
} as const

export interface RemixTestConfig {
  /**
   * Options for controlling the playwright browser
   *  - `browser.echo`: Echo browser console output to stdout (--browser.echo)
   *  - `browser.open`: Open browser window and keep open after test finish (--browser.open)
   */
  browser?: {
    echo?: boolean
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
    test?: string | string[]
    browser?: string | string[]
    e2e?: string | string[]
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
        dir?: string
        include?: string | string[]
        exclude?: string | string[]
        statements?: number | string
        lines?: number | string
        branches?: number | string
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
   * Filter tests to specific playwright project(s) (--project). Accepts a single
   * project name or an array of names; `--project` may be repeated on the CLI.
   */
  project?: string | string[]
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
  reporter: string
  setup: string | undefined
  type: string[]
  watch: boolean
}

export async function loadConfig(args: string[] = process.argv.slice(2), cwd = process.cwd()) {
  let parsed = parseCliArgs(args)
  let fileConfig = await loadConfigFile(parsed.values.config, cwd)
  let config = resolveConfig(fileConfig, parsed)
  return config
}

export function getRemixTestHelpText(_target: NodeJS.WriteStream = process.stdout): string {
  let lines = [
    'Usage: remix-test [glob...] [options]',
    '',
    'Arguments:',
    `  glob                     Glob pattern(s) for test files (default: "${defaultValues.glob.test.join(', ')}")`,
    '',
    'Options:',
  ]

  for (let [long, opt] of Object.entries(cliOptions)) {
    let short = 'short' in opt ? `/-${opt.short}` : ''
    let label = opt.type === 'string' ? `--${long}${short} <value>` : `--${long}${short}`
    lines.push(`  ${label.padEnd(30)} ${opt.description}`)
  }

  lines.push(`  ${'-h, --help'.padEnd(30)} Show this help message`)

  return lines.join('\n')
}

function parseCliArgs(args: string[]) {
  return util.parseArgs({ args, options: cliOptions, allowPositionals: true })
}

function toArray<T>(value: T | readonly T[]): T[] {
  return Array.isArray(value) ? [...value] : [value as T]
}

function resolveConfig(
  fileConfig: RemixTestConfig,
  { values: cliValues, positionals }: ReturnType<typeof parseCliArgs>,
): ResolvedRemixTestConfig {
  let fileCoverage = typeof fileConfig.coverage === 'boolean' ? {} : fileConfig.coverage || {}
  return {
    glob: {
      test: toArray(
        positionals.length > 0
          ? positionals
          : (cliValues['glob.test'] ?? fileConfig.glob?.test ?? defaultValues.glob.test),
      ),
      browser: toArray(
        cliValues['glob.browser'] ?? fileConfig.glob?.browser ?? defaultValues.glob.browser,
      ),
      e2e: toArray(cliValues['glob.e2e'] ?? fileConfig.glob?.e2e ?? defaultValues.glob.e2e),
      exclude: toArray(
        cliValues['glob.exclude'] ?? fileConfig.glob?.exclude ?? defaultValues.glob.exclude,
      ),
    },
    browser: {
      echo: cliValues['browser.echo'] ?? fileConfig.browser?.echo ?? defaultValues.browser.echo,
      open: cliValues['browser.open'] ?? fileConfig.browser?.open ?? defaultValues.browser.open,
    },
    concurrency: Number(
      cliValues.concurrency ?? fileConfig.concurrency ?? defaultValues.concurrency,
    ),
    coverage:
      cliValues.coverage === true || !!fileConfig.coverage
        ? {
            dir: cliValues['coverage.dir'] ?? fileCoverage.dir ?? defaultValues.coverage!.dir,
            include: (() => {
              let raw =
                cliValues['coverage.include'] ??
                fileCoverage.include ??
                defaultValues.coverage!.include
              return raw === undefined ? undefined : toArray(raw)
            })(),
            exclude: (() => {
              let raw =
                cliValues['coverage.exclude'] ??
                fileCoverage.exclude ??
                defaultValues.coverage!.exclude
              return raw === undefined ? undefined : toArray(raw)
            })(),
            statements:
              cliValues['coverage.statements'] !== undefined
                ? Number(cliValues['coverage.statements'])
                : fileCoverage.statements !== undefined
                  ? Number(fileCoverage.statements)
                  : undefined,
            lines:
              cliValues['coverage.lines'] !== undefined
                ? Number(cliValues['coverage.lines'])
                : fileCoverage.lines !== undefined
                  ? Number(fileCoverage.lines)
                  : undefined,
            branches:
              cliValues['coverage.branches'] !== undefined
                ? Number(cliValues['coverage.branches'])
                : fileCoverage.branches !== undefined
                  ? Number(fileCoverage.branches)
                  : undefined,
            functions:
              cliValues['coverage.functions'] !== undefined
                ? Number(cliValues['coverage.functions'])
                : fileCoverage.functions !== undefined
                  ? Number(fileCoverage.functions)
                  : undefined,
          }
        : undefined,
    setup: cliValues.setup ?? fileConfig.setup ?? defaultValues.setup,
    playwrightConfig:
      cliValues.playwrightConfig ?? fileConfig.playwrightConfig ?? defaultValues.playwrightConfig,
    project: (() => {
      let raw = cliValues.project ?? fileConfig.project ?? defaultValues.project
      return raw === undefined ? undefined : toArray(raw)
    })(),
    reporter: cliValues.reporter ?? fileConfig.reporter ?? defaultValues.reporter,
    type: toArray(cliValues.type ?? fileConfig.type ?? defaultValues.type),
    watch: cliValues.watch ?? fileConfig.watch ?? defaultValues.watch,
  }
}

async function loadConfigFile(
  configPath: string | undefined,
  cwd: string,
): Promise<RemixTestConfig> {
  let candidates = configPath
    ? [path.resolve(cwd, configPath)]
    : [path.join(cwd, 'remix-test.config.ts'), path.join(cwd, 'remix-test.config.js')]

  for (let candidate of candidates) {
    try {
      await fsp.access(candidate)
    } catch {
      // not found — try the next candidate
      continue
    }
    // The file exists; let import errors propagate rather than silently
    // falling through to defaults — that masking is what hid "Windows
    // absolute paths aren't valid ESM specifiers" by classifying every
    // browser test as a server test.
    let mod = await importModule(candidate, import.meta)
    return mod.default ?? mod
  }

  return {}
}
