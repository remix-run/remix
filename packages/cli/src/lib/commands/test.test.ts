import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { fileURLToPath } from 'node:url'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { runRemixTest } from '@remix-run/test/cli'

import { runRemix } from '../../index.ts'
import { captureOutput } from '../../../test/capture-output.ts'
import { getTestCommandHelpText, resolveTestCommandOptions } from './test.ts'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')

const TEST_COMMAND_HELP_TEXT = getTestCommandHelpText()

describe('test command', () => {
  it('prints test command help', async () => {
    let result = await captureOutput(() => runRemix(['test', '--help']))
    let helpResult = await captureOutput(() => runRemix(['help', 'test']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, TEST_COMMAND_HELP_TEXT)
    assert.equal(result.stdout, helpResult.stdout)
    assert.equal(result.stderr, '')
    assert.equal(helpResult.exitCode, 0)
    assert.equal(helpResult.stderr, '')
    assert.match(result.stdout, /remix test \[glob\.\.\.\] \[options\]/)
    assert.match(result.stdout, /--browser\.echo/)
    assert.match(result.stdout, /--coverage\.statements/)
    assert.match(result.stdout, /-p, --project <name>/)
    assert.match(result.stdout, /--playwrightConfig <path>/)
  })

  it('parses test arguments and runs tests in the current project', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-test-command-'))

    try {
      await writeTestProject(projectDir)
      await writeNamedTest(projectDir, 'nested/sample.test.ts')

      let result = await captureOutput(() =>
        runRemix(['test', 'sample.test.ts', '-c', '1', '-r', 'spec', '-t', 'server', '-q'], {
          cwd: projectDir,
        }),
      )

      let stdout = stripVTControlCharacters(result.stdout)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(stdout, /Found 1 test file\(s\) \(1 server, 0 browser, 0 e2e\)/)
      assert.match(stdout, /✓ passes/)
      assert.match(stdout, /ℹ pass 1/)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('expands simple names to test globs without running source files or unrelated tests', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-test-partial-'))

    try {
      await writeTestProject(projectDir)
      await writeNamedTest(projectDir, 'src/frame.test.ts')
      await writeNamedTest(projectDir, 'src/frame.css.test.ts')
      await writeNamedTest(projectDir, 'src/frame.test.integration.tsx')
      await writeNamedTest(projectDir, 'src/frame.test.browser.ts')
      await fs.writeFile(path.join(projectDir, 'src/frame.ts'), 'throw new Error("source loaded")')

      let result = await captureOutput(() =>
        runRemix(['test', 'frame', '--type', 'server', '--concurrency', '1'], { cwd: projectDir }),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(result.stdout, /Found 3 test file\(s\) \(3 server, 0 browser, 0 e2e\)/)
      assert.match(result.stdout, /src[/\\]frame\.test\.ts/)
      assert.match(result.stdout, /src[/\\]frame\.css\.test\.ts/)
      assert.match(result.stdout, /src[/\\]frame\.test\.integration\.tsx/)
      assert.doesNotMatch(result.stdout, /sample\.test\.ts/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('lets expanded names override configured globs while respecting exclusions', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-test-simple-config-'))

    try {
      await writeTestProject(projectDir)
      await writeNamedTest(projectDir, 'spec/frame.spec.ts')
      await writeNamedTest(projectDir, 'src/frame.test.ts')
      await writeNamedTest(projectDir, 'src/frame-excluded.test.ts')
      await fs.writeFile(
        path.join(projectDir, 'remix.json'),
        JSON.stringify({
          test: {
            files: ['spec/**/*.spec.ts'],
            exclude: ['**/*excluded*'],
            concurrency: 1,
          },
        }),
      )

      let result = await captureOutput(() =>
        runRemix(['test', 'frame', '--glob.test', 'missing/**/*.test.ts'], { cwd: projectDir }),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(result.stdout, /Found 1 test file/)
      assert.match(result.stdout, /src[/\\]frame\.test\.ts/)
      assert.doesNotMatch(result.stdout, /frame-excluded|spec[/\\]frame\.spec\.ts/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('unions expanded names, exact files, and globs without running duplicates', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-test-patterns-'))

    try {
      await writeTestProject(projectDir)
      await writeNamedTest(projectDir, 'src/frame.test.ts')
      await writeNamedTest(projectDir, 'src/navigation.test.ts')
      await writeNamedTest(projectDir, 'custom/check.ts')
      await writeNamedTest(projectDir, 'custom/excluded.ts')

      let result = await captureOutput(() =>
        runRemix(
          [
            'test',
            'frame',
            'navigation',
            'src/frame.test.ts',
            'custom/*.ts',
            '--glob.exclude',
            '**/excluded.ts',
            '--concurrency',
            '1',
          ],
          { cwd: projectDir },
        ),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(result.stdout, /Found 3 test file/)
      assert.match(result.stdout, /src[/\\]frame\.test\.ts/)
      assert.match(result.stdout, /src[/\\]navigation\.test\.ts/)
      assert.match(result.stdout, /custom[/\\]check\.ts/)
      assert.doesNotMatch(result.stdout, /sample\.test\.ts|custom[/\\]excluded\.ts/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('preserves glob syntax and file paths when expanding simple names', () => {
    let options = resolveTestCommandOptions(
      [
        'frame',
        'src/frame.test.ts',
        './frame.test.ts',
        '/tmp/frame.test.ts',
        'C:\\tests\\frame.test.ts',
        'frame.test.ts',
        'frame.test.tsx',
        './frame.spec.js',
        'src/frames',
        'src/**/*.test.ts',
        '**/?(frame|router).test.ts',
        '*.{test,spec}.ts',
        'frame[12].test.ts',
      ],
      undefined,
      ['forks', 'threads'],
    )

    assert.deepEqual(options.glob?.test, [
      '**/*frame*.test*.{ts,tsx}',
      'src/frame.test.ts',
      './frame.test.ts',
      '/tmp/frame.test.ts',
      'C:\\tests\\frame.test.ts',
      'frame.test.ts',
      'frame.test.tsx',
      './frame.spec.js',
      'src/frames',
      'src/**/*.test.ts',
      '**/?(frame|router).test.ts',
      '*.{test,spec}.ts',
      'frame[12].test.ts',
    ])
  })

  it('reports unmatched names and globs without running unrelated tests', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-test-no-match-'))

    try {
      await writeTestProject(projectDir)

      let partial = await captureOutput(() => runRemix(['test', 'missing'], { cwd: projectDir }))
      let glob = await captureOutput(() =>
        runRemix(['test', 'missing/**/*.test.ts'], { cwd: projectDir }),
      )

      assert.equal(partial.exitCode, 1)
      assert.match(partial.stdout, /No test files found matching pattern: \*\*\/\*missing\*\.test/)
      assert.equal(glob.exitCode, 1)
      assert.match(glob.stdout, /No test files found matching pattern: missing\/\*\*\/\*\.test\.ts/)
      assert.doesNotMatch(partial.stdout, /Running server tests/)
      assert.doesNotMatch(glob.stdout, /Running server tests/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('loads test defaults from a commented remix.json file', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-config-'))

    try {
      await writeTestProject(projectDir)
      await fs.writeFile(
        path.join(projectDir, 'remix.json'),
        [
          '{',
          '  // Test command defaults',
          '  "test": {',
          '    "files": ["sample.test.ts"],',
          '    "concurrency": 1,',
          '    "reporter": "spec",',
          '    "type": ["server"],',
          '  },',
          '}',
        ].join('\n'),
        'utf8',
      )

      let result = await captureOutput(() => runRemix(['test'], { cwd: projectDir }))

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(stripVTControlCharacters(result.stdout), /✓ passes/)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('loads a custom config and resolves its paths from the config directory', async () => {
    let rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-custom-config-'))
    let projectDir = path.join(rootDir, 'project')
    let configDir = path.join(rootDir, 'config')

    try {
      await fs.mkdir(projectDir)
      await fs.mkdir(configDir)
      await writeTestProject(projectDir)
      await fs.writeFile(
        path.join(configDir, 'setup.ts'),
        [
          "import * as fs from 'node:fs/promises'",
          "import { fileURLToPath } from 'node:url'",
          '',
          'export async function globalSetup() {',
          "  await fs.writeFile(fileURLToPath(new URL('./setup-ran', import.meta.url)), '')",
          '}',
        ].join('\n'),
        'utf8',
      )
      await fs.writeFile(
        path.join(configDir, 'custom.jsonc'),
        [
          '{',
          '  "test": {',
          '    "files": ["../project/sample.test.ts"],',
          '    "concurrency": 1,',
          '    "reporter": "spec",',
          '    "setup": "./setup.ts",',
          '    "type": ["server"]',
          '  }',
          '}',
        ].join('\n'),
        'utf8',
      )

      let result = await captureOutput(() =>
        runRemix(['test', '--config=../config/custom.jsonc'], { cwd: projectDir }),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(stripVTControlCharacters(result.stdout), /✓ passes/)
      await fs.access(path.join(configDir, 'setup-ran'))
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true })
    }
  })

  it('lets negative CLI flags override configured booleans', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-config-boolean-'))

    try {
      await writeTestProject(projectDir)
      await fs.writeFile(
        path.join(projectDir, 'skipped.test.ts'),
        [
          "import { it } from '@remix-run/test'",
          '',
          "it('configured skip', { skip: 'not today' }, () => {})",
        ].join('\n'),
        'utf8',
      )
      await fs.writeFile(
        path.join(projectDir, 'remix.json'),
        JSON.stringify({
          test: {
            concurrency: 1,
            files: ['skipped.test.ts'],
            quiet: true,
            reporter: 'spec',
            type: ['server'],
          },
        }),
        'utf8',
      )

      let result = await captureOutput(() =>
        runRemix(['test', '--quiet', '--no-quiet'], { cwd: projectDir }),
      )
      let reversed = await captureOutput(() =>
        runRemix(['test', '--no-quiet', '--quiet'], { cwd: projectDir }),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(stripVTControlCharacters(result.stdout), /configured skip/)
      assert.equal(reversed.exitCode, 0, reversed.stderr)
      assert.doesNotMatch(stripVTControlCharacters(reversed.stdout), /configured skip/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('uses the last positive or negative form of each boolean flag', () => {
    let config = {
      coverage: { dir: '/tmp/coverage', enabled: true },
      playwright: { echo: true, open: true },
      watch: true,
    }

    let positiveThenNegative = resolveTestCommandOptions(
      [
        '--coverage',
        '--no-coverage',
        '--browser.echo',
        '--no-browser.echo',
        '--browser.open',
        '--no-browser.open',
        '--watch',
        '--no-watch',
      ],
      config,
      ['forks', 'threads'],
    )
    let negativeThenPositive = resolveTestCommandOptions(
      [
        '--no-coverage',
        '--coverage',
        '--no-browser.echo',
        '--browser.echo',
        '--no-browser.open',
        '--browser.open',
        '--no-watch',
        '--watch',
      ],
      config,
      ['forks', 'threads'],
    )

    assert.equal(positiveThenNegative.coverage, false)
    assert.deepEqual(positiveThenNegative.browser, { echo: false, open: false })
    assert.equal(positiveThenNegative.watch, false)
    assert.deepEqual(negativeThenPositive.coverage, {
      dir: '/tmp/coverage',
      enabled: true,
    })
    assert.deepEqual(negativeThenPositive.browser, { echo: true, open: true })
    assert.equal(negativeThenPositive.watch, true)
  })

  it('lets CLI arrays, scalars, and positional globs replace configured values', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-config-precedence-'))

    try {
      await writeTestProject(projectDir)
      await fs.writeFile(
        path.join(projectDir, 'remix.json'),
        JSON.stringify({
          test: {
            concurrency: 1,
            files: ['missing.test.ts'],
            only: ['does not match'],
            reporter: 'tap',
            type: ['browser'],
            watch: true,
          },
        }),
        'utf8',
      )

      let result = await captureOutput(() =>
        runRemix(
          [
            'test',
            'sample.test.ts',
            '--only',
            'passes',
            '--reporter',
            'spec',
            '--type',
            'server',
            '--no-watch',
          ],
          { cwd: projectDir },
        ),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(stripVTControlCharacters(result.stdout), /✓ passes/)
      assert.doesNotMatch(result.stdout, /^TAP version/m)
      assert.doesNotMatch(result.stdout, /Watching for changes/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('merges nested coverage flags with configured coverage paths', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-config-coverage-'))

    try {
      await writeTestProject(projectDir)
      await fs.writeFile(path.join(projectDir, 'covered.ts'), 'export let answer = 42\n', 'utf8')
      await fs.writeFile(
        path.join(projectDir, 'sample.test.ts'),
        [
          "import * as assert from 'node:assert/strict'",
          "import { it } from '@remix-run/test'",
          "import { answer } from './covered.ts'",
          '',
          "it('passes', () => assert.equal(answer, 42))",
        ].join('\n'),
        'utf8',
      )
      await fs.writeFile(
        path.join(projectDir, 'remix.json'),
        JSON.stringify({
          test: {
            concurrency: 1,
            coverage: {
              dir: './configured-coverage',
              enabled: true,
              statements: 0,
            },
            files: ['sample.test.ts'],
            type: ['server'],
          },
        }),
        'utf8',
      )

      let result = await captureOutput(() =>
        runRemix(['test', '--coverage.lines', '0'], { cwd: projectDir }),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(result.stdout, /Coverage report:/)
      await fs.access(path.join(projectDir, 'configured-coverage', 'lcov.info'))
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports missing and invalid selected config files before running tests', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-config-errors-'))

    try {
      await writeTestProject(projectDir)
      await fs.writeFile(path.join(projectDir, 'invalid.jsonc'), '{\n  "test": nope\n}', 'utf8')

      let missing = await captureOutput(() =>
        runRemix(['test', '--config', 'missing.jsonc'], { cwd: projectDir }),
      )
      let invalid = await captureOutput(() =>
        runRemix(['--config', 'invalid.jsonc', 'test'], { cwd: projectDir }),
      )

      assert.equal(missing.exitCode, 1)
      assert.match(missing.stderr, /Error \[RMX_CONFIG_NOT_FOUND\]/)
      assert.match(missing.stderr, /missing\.jsonc/)
      assert.doesNotMatch(missing.stdout, /Found .* test file/)

      assert.equal(invalid.exitCode, 1)
      assert.match(invalid.stderr, /Error \[RMX_INVALID_CONFIG\]/)
      assert.match(invalid.stderr, /invalid\.jsonc:2:/)
      assert.doesNotMatch(invalid.stdout, /Found .* test file/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('invokes the test package directly with typed options', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-test-api-'))

    try {
      await writeTestProject(projectDir)

      let result = await captureOutput(() =>
        runRemixTest({
          concurrency: 1,
          cwd: projectDir,
          glob: { test: 'sample.test.ts' },
          reporter: 'spec',
          type: ['server'],
        }),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(stripVTControlCharacters(result.stdout), /✓ passes/)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('exits watch mode when no test files can be found', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-test-command-empty-'))

    try {
      await fs.writeFile(
        path.join(projectDir, 'package.json'),
        `${JSON.stringify({ name: 'test-command-empty-fixture', private: true, type: 'module' }, null, 2)}\n`,
        'utf8',
      )

      let result = await captureOutput(() =>
        runRemix(['test', '--watch', '--glob.test', 'missing/**/*.test.ts'], {
          cwd: projectDir,
        }),
      )

      assert.equal(result.exitCode, 1, result.stderr)
      assert.match(
        result.stdout,
        /No test files found matching pattern: missing\/\*\*\/\*\.test\.ts/,
      )
      assert.doesNotMatch(result.stdout, /Watching for changes/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports invalid test arguments as CLI usage errors', async () => {
    let unknown = await captureOutput(() => runRemix(['test', '--wat']))
    let missing = await captureOutput(() => runRemix(['test', '--config']))
    let empty = await captureOutput(() => runRemix(['test', '--config', '']))

    assert.equal(unknown.exitCode, 1)
    assert.match(unknown.stderr, /Error \[RMX_UNKNOWN_ARGUMENT\] Unknown argument/)
    assert.match(unknown.stderr, /Unknown argument: --wat/)
    assert.match(unknown.stderr, /Usage:/)

    assert.equal(missing.exitCode, 1)
    assert.match(missing.stderr, /Error \[RMX_MISSING_OPTION_VALUE\] Missing option value/)
    assert.match(missing.stderr, /--config requires a value\./)
    assert.match(missing.stderr, /Usage:/)

    assert.equal(empty.exitCode, 1)
    assert.match(empty.stderr, /Error \[RMX_MISSING_OPTION_VALUE\] Missing option value/)
    assert.match(empty.stderr, /--config requires a value\./)
  })

  it('rejects non-numeric values for numeric options', async () => {
    let concurrency = await captureOutput(() => runRemix(['test', '--concurrency', 'abc']))
    let threshold = await captureOutput(() => runRemix(['test', '--coverage.lines', '']))

    assert.equal(concurrency.exitCode, 1)
    assert.match(concurrency.stderr, /Error \[RMX_INVALID_OPTION_VALUE\] Invalid option value/)
    assert.match(concurrency.stderr, /Invalid --concurrency value "abc"\. Expected a number/)

    assert.equal(threshold.exitCode, 1)
    assert.match(threshold.stderr, /Invalid --coverage\.lines value ""\. Expected a number/)
  })

  it('rejects non-integer concurrency values', async () => {
    let fractional = await captureOutput(() => runRemix(['test', '--concurrency', '2.5']))
    let zero = await captureOutput(() => runRemix(['test', '-c', '0']))

    assert.equal(fractional.exitCode, 1)
    assert.match(fractional.stderr, /Error \[RMX_INVALID_OPTION_VALUE\] Invalid option value/)
    assert.match(
      fractional.stderr,
      /Invalid --concurrency value "2\.5"\. Expected a positive integer/,
    )

    assert.equal(zero.exitCode, 1)
    assert.match(zero.stderr, /Invalid --concurrency value "0"\. Expected a positive integer/)
  })

  it('treats help flags after -- as positional globs', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-test-command-separator-'))

    try {
      await fs.writeFile(
        path.join(projectDir, 'package.json'),
        `${JSON.stringify({ name: 'test-command-separator-fixture', private: true, type: 'module' }, null, 2)}\n`,
        'utf8',
      )

      let result = await captureOutput(() => runRemix(['test', '--', '-h'], { cwd: projectDir }))

      assert.equal(result.exitCode, 1, result.stderr)
      assert.match(result.stdout, /No test files found matching pattern: \*\*\/\*-h\*\.test/)
      assert.doesNotMatch(result.stdout, /Usage:/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('rejects unsupported pool values', async () => {
    let result = await captureOutput(() => runRemix(['test', '--pool', 'workers']))

    assert.equal(result.exitCode, 1)
    assert.match(result.stderr, /Error \[RMX_INVALID_OPTION_VALUE\] Invalid option value/)
    assert.match(
      result.stderr,
      /Unsupported test pool "workers"\. Supported pools are: forks, threads/,
    )
  })

  it('documents defaults in the help text', () => {
    assert.match(TEST_COMMAND_HELP_TEXT, /default: os\.availableParallelism\(\)/)
    assert.match(TEST_COMMAND_HELP_TEXT, /default: \.coverage/)
    assert.match(TEST_COMMAND_HELP_TEXT, /default: forks/)
    assert.match(TEST_COMMAND_HELP_TEXT, /default: spec/)
    assert.match(TEST_COMMAND_HELP_TEXT, /default: server, browser, e2e/)
    assert.match(TEST_COMMAND_HELP_TEXT, /--config <path>/)
    assert.match(TEST_COMMAND_HELP_TEXT, /--no-coverage/)
  })
})

async function writeNamedTest(projectDir: string, file: string): Promise<void> {
  await fs.mkdir(path.dirname(path.join(projectDir, file)), { recursive: true })
  await fs.writeFile(
    path.join(projectDir, file),
    [
      "import { describe, it } from '@remix-run/test'",
      `describe(${JSON.stringify(file)}, () => {`,
      "  it('passes', () => {})",
      '})',
    ].join('\n'),
  )
}

async function writeTestProject(projectDir: string): Promise<void> {
  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    `${JSON.stringify({ name: 'test-command-fixture', private: true, type: 'module' }, null, 2)}\n`,
    'utf8',
  )
  await fs.mkdir(path.join(projectDir, 'node_modules', '@remix-run'), { recursive: true })
  await fs.symlink(
    path.join(ROOT_DIR, 'packages', 'test'),
    path.join(projectDir, 'node_modules', '@remix-run', 'test'),
  )
  await fs.writeFile(
    path.join(projectDir, 'sample.test.ts'),
    [
      "import * as assert from 'node:assert/strict'",
      "import { it } from '@remix-run/test'",
      '',
      "it('passes', () => {",
      '  assert.equal(1 + 1, 2)',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )
}
