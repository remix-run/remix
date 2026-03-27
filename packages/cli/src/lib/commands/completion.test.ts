import * as assert from 'node:assert/strict'
import * as process from 'node:process'
import { describe, it } from 'node:test'

import { run } from '../../index.ts'

describe('completion command', () => {
  it('prints completion command help', async () => {
    let result = await captureOutput(() => run(['completion', '--help']))

    assert.equal(result.exitCode, 0)
    assert.match(result.stdout, /Usage:\s+remix completion <bash\|zsh>/)
    assert.match(result.stdout, /remix completion bash >> ~\/\.bashrc/)
    assert.match(result.stdout, /remix completion zsh >> ~\/\.zshrc/)
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
    assert.match(result.stderr, /Unknown completion shell: fish/)
    assert.match(result.stderr, /Usage:\s+remix completion <bash\|zsh>/)
  })

  it('returns machine-readable completions in plumbing mode', async () => {
    let result = await captureOutput(() => run(['completion', '--', '2', 'remix', 'skills', '']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, 'mode:values\ninstall\nlist\nstatus\n-h\n--help\n--no-color\n')
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
