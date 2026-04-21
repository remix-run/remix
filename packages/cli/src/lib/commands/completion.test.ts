import * as assert from 'node:assert/strict'
import * as process from 'node:process'
import { describe, it } from 'node:test'

import { run } from '../../index.ts'

const COMPLETION_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix completion <bash|zsh>',
  '',
  'Print a shell completion script for Remix.',
  '',
  'Examples:',
  '  remix completion bash >> ~/.bashrc',
  '  remix completion zsh >> ~/.zshrc',
  '',
].join('\n')

const UNKNOWN_COMPLETION_SHELL_ERROR_TEXT = [
  'Error [RMX_UNKNOWN_COMPLETION_SHELL] Unknown completion shell',
  'Unknown completion shell: fish',
  '',
  'Try:',
  '  Run `remix completion bash` or `remix completion zsh`.',
  '',
  COMPLETION_COMMAND_HELP_TEXT,
].join('\n')

describe('completion command', () => {
  it('prints completion command help', async () => {
    let result = await captureOutput(() => run(['completion', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, COMPLETION_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints the same wrapper for bash and zsh', async () => {
    let bashResult = await captureOutput(() => run(['completion', 'bash']))
    let zshResult = await captureOutput(() => run(['completion', 'zsh']))

    assert.equal(bashResult.exitCode, 0)
    assert.equal(zshResult.exitCode, 0)
    assert.equal(bashResult.stdout, zshResult.stdout)
    assert.match(bashResult.stdout, /complete -o default -F _remix_completion remix/)
    assert.match(bashResult.stdout, /compdef _remix_completion remix/)
    assert.equal(bashResult.stderr, '')
    assert.equal(zshResult.stderr, '')
  })

  it('fails for unsupported shells', async () => {
    let result = await captureOutput(() => run(['completion', 'fish']))

    assert.equal(result.exitCode, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, UNKNOWN_COMPLETION_SHELL_ERROR_TEXT)
  })

  it('returns machine-readable completions in plumbing mode', async () => {
    let result = await captureOutput(() => run(['completion', '--', '2', 'remix', 'skills', '']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, 'mode:values\ninstall\nlist\n-h\n--help\n--no-color\n')
    assert.equal(result.stderr, '')
  })
})

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
