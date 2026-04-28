import * as assert from '@remix-run/assert'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, it } from '@remix-run/test'

import { run } from '../../index.ts'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')

const TEST_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix test [glob] [options]',
  '',
  'Run tests for the current project.',
  '',
  'Examples:',
  '  remix test',
  '  remix test --watch',
  '  remix test --coverage',
  '  remix test --glob.test "src/**/*.test.ts"',
  '',
].join('\n')

describe('test command', () => {
  it('prints test command help', async () => {
    let result = await captureOutput(() => run(['test', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, TEST_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('runs remix-test in the current project', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-test-command-'))

    try {
      await writeTestProject(projectDir)

      let result = await captureOutput(() =>
        run(['test', '--concurrency', '1', '--reporter', 'spec', '--type', 'server'], {
          cwd: projectDir,
        }),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(result.stdout, /Found 1 test file\(s\) \(1 server, 0 e2e\)/)
      assert.match(result.stdout, /✓ passes/)
      assert.match(result.stdout, /ℹ pass 1/)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })
})

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
    ["import { it } from '@remix-run/test'", '', "it('passes', () => {})", ''].join('\n'),
    'utf8',
  )
}

async function captureOutput(
  callback: () => Promise<number>,
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  let stderr = ''
  let stdout = ''
  let originalStdoutWrite = process.stdout.write
  let originalStderrWrite = process.stderr.write

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stdout.write

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stderr.write

  try {
    let exitCode = await callback()
    return { exitCode, stderr, stdout }
  } finally {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
  }
}
