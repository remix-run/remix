import * as os from 'node:os'
import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import * as util from 'node:util'
import { tsImport } from 'tsx/esm/api'
import type { PlaywrightTestConfig } from 'playwright/test'

export const defaultTestGlob = '**/*.test?(.e2e).{ts,tsx}'

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
  'glob.e2e': {
    type: 'string',
    description: 'Glob pattern for E2E test files',
  },
  'glob.test': {
    type: 'string',
    description: 'Glob pattern for all test files',
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
    description: 'Filter to a specific Playwright project (comma-separated)',
  },
  reporter: {
    type: 'string',
    short: 'r',
    description: 'Test reporter: spec, files, tap, dot (default: spec)',
  },
  type: {
    type: 'string',
    short: 't',
    description: 'Comma-separated test types to run: server, browser, e2e (default: server,browser,e2e)',
  },
  watch: {
    type: 'boolean',
    short: 'w',
    description: 'Re-run tests on file changes',
  },
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
   * Glob patterns to identify test files
   *  - `glob.test`: Glob pattern for all test files (--glob.test)
   *  - `glob.e2e`: Glob pattern for the subset of e2e test files (--glob.e2e)
   */
  glob?: {
    test?: string
    e2e?: string
  }
  /** Max number of concurrent test workers (--concurrency) */
  concurrency?: number | string
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
  /** Filter tests to a specific playwright project or comma-separated list of projects (--project) */
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
  }
  concurrency: number
  glob: {
    test: string
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
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp())
    process.exit(0)
  }

  let parsed = parseCliArgs()
  let fileConfig = await loadConfigFile(parsed.values.config)
  let config = resolveConfig(fileConfig, parsed)
  return config
}

function generateHelp(): string {
  let lines = [
    'Usage: remix-test [glob] [options]',
    '',
    'Arguments:',
    `  glob                     Glob pattern for test files (default: "${defaultTestGlob}")`,
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

function parseCliArgs(args = process.argv.slice(2)) {
  return util.parseArgs({ args, options: cliOptions, allowPositionals: true })
}

function resolveConfig(
  fileConfig: RemixTestConfig,
  { values: cliValues, positionals }: ReturnType<typeof parseCliArgs>,
): ResolvedRemixTestConfig {
  return {
    glob: {
      test: positionals[0] ?? cliValues['glob.test'] ?? fileConfig.glob?.test ?? defaultTestGlob,
      e2e: cliValues['glob.e2e'] ?? fileConfig.glob?.e2e ?? '**/*.test.e2e.{ts,tsx}',
    },
    browser: {
      echo: cliValues['browser.echo'] ?? fileConfig.browser?.echo,
      open: cliValues['browser.open'] ?? fileConfig.browser?.open,
    },
    concurrency: Number(
      cliValues.concurrency ?? fileConfig.concurrency ?? os.availableParallelism(),
    ),
    setup: cliValues.setup ?? fileConfig.setup,
    playwrightConfig: cliValues.playwrightConfig ?? fileConfig.playwrightConfig,
    project: cliValues.project ?? fileConfig.project,
    reporter:
      cliValues.reporter ?? fileConfig.reporter ?? (process.env.CI === 'true' ? 'dot' : 'spec'),
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
