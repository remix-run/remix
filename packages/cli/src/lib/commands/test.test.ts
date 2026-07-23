import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { fileURLToPath } from 'node:url'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { runTests } from '@remix-run/test/cli'

import { runRemix } from '../../index.ts'
import { captureOutput } from '../../../test/capture-output.ts'
import { getTestCommandHelpText } from './test.ts'

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

  it('invokes the test package directly with typed options', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-test-api-'))

    try {
      await writeTestProject(projectDir)

      let result = await captureOutput(() =>
        runTests({
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

    assert.equal(unknown.exitCode, 1)
    assert.match(unknown.stderr, /Error \[RMX_UNKNOWN_ARGUMENT\] Unknown argument/)
    assert.match(unknown.stderr, /Unknown argument: --wat/)
    assert.match(unknown.stderr, /Usage:/)

    assert.equal(missing.exitCode, 1)
    assert.match(missing.stderr, /Error \[RMX_MISSING_OPTION_VALUE\] Missing option value/)
    assert.match(missing.stderr, /--config requires a value\./)
    assert.match(missing.stderr, /Usage:/)
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
    assert.match(TEST_COMMAND_HELP_TEXT, /default: remix-test\.config\.ts/)
    assert.match(TEST_COMMAND_HELP_TEXT, /default: \.coverage/)
    assert.match(TEST_COMMAND_HELP_TEXT, /default: forks/)
    assert.match(TEST_COMMAND_HELP_TEXT, /default: spec/)
    assert.match(TEST_COMMAND_HELP_TEXT, /default: server, browser, e2e/)
  })
})

async function writeTestProject(projectDir: string): Promise<void> {
  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    `${JSON.stringify({ name: 'test-command-fixture', private: true, type: 'module' }, null, 2)}\n`,
    'utf8',
  )
  await fs.writeFile(
    path.join(projectDir, 'remix-test.config.ts'),
    `export default { concurrency: 2, glob: { test: 'missing.test.ts' }, type: ['browser'] }\n`,
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
