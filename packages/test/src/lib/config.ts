import * as os from 'node:os'
import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import * as util from 'node:util'
import { tsImport } from 'tsx/esm/api'

export const defaultTestGlob = '**/*.test?(.browser)?(.e2e).{ts,tsx}'

const cliOptions = {
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
  reporter: { type: 'string', short: 'r' },
  type: { type: 'string', short: 't' },
  watch: { type: 'boolean', short: 'w' },
} as const

export interface RemixTestConfig {
  /**
   * Glob patterns to identify test files
   *  - `glob.test`: Glob pattern for all test files (--glob.test)
   */
  glob?: {
    test?: string
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
   * Path to a module that exports `globalSetup` and/or `globalTeardown` functions,
   * called once before and after the test run respectively. (--setup)
   */
  setup?: string
  /** Test reporter (--reporter) */
  reporter?: string
  /** Watch mode — re-run tests on file changes (--watch) */
  watch?: boolean
}

export interface ResolvedRemixTestConfig {
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
  }
  setup?: string
  reporter: string
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
    reporter:
      cliValues.reporter ?? fileConfig.reporter ?? (process.env.CI === 'true' ? 'dot' : 'spec'),
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
