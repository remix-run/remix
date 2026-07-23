import * as process from 'node:process'
import { parseArgs } from 'node:util'

import type { CliContext } from '../cli-context.ts'
import { invalidOptionValue, renderCliError, toCliError, unknownArgument } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'

const testCommandOptions = {
  'browser.echo': { type: 'boolean' },
  'browser.open': { type: 'boolean' },
  'glob.browser': { type: 'string', multiple: true },
  'glob.e2e': { type: 'string', multiple: true },
  'glob.exclude': { type: 'string', multiple: true },
  'glob.test': { type: 'string', multiple: true },
  concurrency: { type: 'string', short: 'c' },
  config: { type: 'string' },
  coverage: { type: 'boolean' },
  'coverage.dir': { type: 'string' },
  'coverage.include': { type: 'string', multiple: true },
  'coverage.exclude': { type: 'string', multiple: true },
  'coverage.branches': { type: 'string' },
  'coverage.functions': { type: 'string' },
  'coverage.lines': { type: 'string' },
  'coverage.statements': { type: 'string' },
  setup: { type: 'string', short: 's' },
  playwrightConfig: { type: 'string' },
  project: { type: 'string', short: 'p', multiple: true },
  pool: { type: 'string' },
  quiet: { type: 'boolean', short: 'q' },
  only: { type: 'string', multiple: true },
  reporter: { type: 'string', short: 'r' },
  type: { type: 'string', short: 't', multiple: true },
  watch: { type: 'boolean', short: 'w' },
} as const

export async function runTestCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getTestCommandHelpText())
    return 0
  }

  try {
    let options = parseTestCommandArgs(argv)
    let { runRemixTest } = await import('@remix-run/test/cli')
    return await runRemixTest({ ...options, cwd: context.cwd })
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), {
        helpText: getTestCommandHelpText(process.stderr),
      }),
    )
    return 1
  }
}

export function getTestCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description: 'Run tests for the current project.',
      examples: [
        'remix test',
        'remix test app/**/*.test.ts',
        'remix test --type server --concurrency 1',
        'remix test --coverage',
        'remix test --watch',
      ],
      options: [
        { description: 'Echo browser console output', label: '--browser.echo' },
        { description: 'Open the browser after tests finish', label: '--browser.open' },
        {
          description: 'Glob pattern for browser test files (repeatable)',
          label: '--glob.browser <glob>',
        },
        { description: 'Glob pattern for E2E test files (repeatable)', label: '--glob.e2e <glob>' },
        {
          description: 'Glob pattern to exclude from discovery (repeatable)',
          label: '--glob.exclude <glob>',
        },
        {
          description: 'Glob pattern for all test files (repeatable)',
          label: '--glob.test <glob>',
        },
        { description: 'Maximum concurrent test workers', label: '-c, --concurrency <count>' },
        { description: 'Path to a test config file', label: '--config <path>' },
        { description: 'Collect test coverage', label: '--coverage' },
        { description: 'Coverage report output directory', label: '--coverage.dir <path>' },
        { description: 'Coverage inclusion glob (repeatable)', label: '--coverage.include <glob>' },
        { description: 'Coverage exclusion glob (repeatable)', label: '--coverage.exclude <glob>' },
        {
          description: 'Minimum branch coverage percentage',
          label: '--coverage.branches <percent>',
        },
        {
          description: 'Minimum function coverage percentage',
          label: '--coverage.functions <percent>',
        },
        { description: 'Minimum line coverage percentage', label: '--coverage.lines <percent>' },
        {
          description: 'Minimum statement coverage percentage',
          label: '--coverage.statements <percent>',
        },
        { description: 'Path to a setup module', label: '-s, --setup <path>' },
        { description: 'Path to a Playwright config file', label: '--playwrightConfig <path>' },
        { description: 'Playwright project name (repeatable)', label: '-p, --project <name>' },
        { description: 'Worker pool: forks or threads', label: '--pool <pool>' },
        { description: 'Do not print skipped tests', label: '-q, --quiet' },
        { description: 'Test name pattern (repeatable)', label: '--only <pattern>' },
        { description: 'Reporter: spec, files, tap, or dot', label: '-r, --reporter <name>' },
        {
          description: 'Test type: server, browser, or e2e (repeatable)',
          label: '-t, --type <type>',
        },
        { description: 'Re-run tests when files change', label: '-w, --watch' },
        { description: 'Show help', label: '-h, --help' },
        { description: 'Disable ANSI color output', label: '--no-color' },
      ],
      usage: ['remix test [glob...] [options]'],
    },
    target,
  )
}

function parseTestCommandArgs(argv: string[]) {
  let parsed: ReturnType<typeof parseTestCommandArgsRaw>

  try {
    parsed = parseTestCommandArgsRaw(argv)
  } catch (error) {
    throw toTestCommandUsageError(error)
  }

  let { positionals, values } = parsed
  let coverage = createCoverageOptions(values)
  let glob = compactObject({
    browser: values['glob.browser'],
    e2e: values['glob.e2e'],
    exclude: values['glob.exclude'],
    test: positionals.length > 0 ? positionals : values['glob.test'],
  })

  return compactObject({
    browser: compactObject({
      echo: values['browser.echo'] || undefined,
      open: values['browser.open'] || undefined,
    }),
    concurrency: optionalNumber(values.concurrency),
    config: values.config,
    coverage,
    glob,
    only: values.only,
    playwrightConfig: values.playwrightConfig,
    pool: parsePool(values.pool),
    project: values.project,
    quiet: values.quiet || undefined,
    reporter: values.reporter,
    setup: values.setup,
    type: values.type,
    watch: values.watch || undefined,
  })
}

function createCoverageOptions(values: ReturnType<typeof parseTestCommandArgsRaw>['values']) {
  let options = compactObject({
    branches: optionalNumber(values['coverage.branches']),
    dir: values['coverage.dir'],
    exclude: values['coverage.exclude'],
    functions: optionalNumber(values['coverage.functions']),
    include: values['coverage.include'],
    lines: optionalNumber(values['coverage.lines']),
    statements: optionalNumber(values['coverage.statements']),
  })

  if (values.coverage) {
    return options ?? true
  }

  return options == null ? undefined : { ...options, enabled: undefined }
}

function parseTestCommandArgsRaw(argv: string[]) {
  return parseArgs({
    allowPositionals: true,
    args: argv,
    options: testCommandOptions,
  })
}

function optionalNumber(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value)
}

function parsePool(value: string | undefined): 'forks' | 'threads' | undefined {
  if (value === undefined || value === 'forks' || value === 'threads') {
    return value
  }

  throw invalidOptionValue(`Unsupported test pool "${value}". Supported pools are: forks, threads`)
}

function compactObject<shape extends object>(value: shape): shape | undefined {
  return Object.values(value).every((entry) => entry === undefined) ? undefined : value
}

function toTestCommandUsageError(error: unknown): unknown {
  if (!isErrorWithCode(error)) {
    return error
  }

  if (error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
    let option = error.message.match(/'([^']+)'/)?.[1]
    return unknownArgument(option ?? error.message)
  }

  if (error.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') {
    return invalidOptionValue(error.message)
  }

  return error
}

function isErrorWithCode(error: unknown): error is Error & { code: string } {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
}
