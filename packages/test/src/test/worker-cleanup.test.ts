import * as assert from '@remix-run/assert'
import { spawn } from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from '../lib/framework.ts'
import { IS_BUN } from '../lib/runtime.ts'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIXTURE_DIR = path.join(PKG_DIR, '.tmp', 'worker-cleanup')
const FIXTURE_FILE = path.join(FIXTURE_DIR, 'leaked-worker.test.ts')

function runCli(
  args: string[],
  timeoutMs: number,
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    let child = spawn(process.execPath, ['src/cli-entry.ts', ...args], {
      cwd: PKG_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let chunks: Buffer[] = []
    let timedOut = false
    let timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr?.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.once('error', reject)
    child.once('close', (code) => {
      clearTimeout(timeout)
      let output = Buffer.concat(chunks).toString('utf-8')

      if (timedOut) {
        reject(new Error(`remix-test did not exit within ${timeoutMs}ms\n${output}`))
        return
      }

      resolve({ code, output })
    })
  })
}

describe('worker cleanup', () => {
  it('terminates test workers after receiving results', { skip: IS_BUN }, async () => {
    await fsp.rm(FIXTURE_DIR, { recursive: true, force: true })
    await fsp.mkdir(FIXTURE_DIR, { recursive: true })
    await fsp.writeFile(
      FIXTURE_FILE,
      `
import { Worker } from 'node:worker_threads'
import { describe, it } from '../../src/lib/framework.ts'

process.exit = (() => undefined) as typeof process.exit

describe('leaked worker fixture', () => {
  it('passes while leaving a worker running', () => {
    new Worker('setInterval(() => {}, 1000)', { eval: true })
  })
})
`,
    )

    try {
      let result = await runCli(
        ['--type', 'server', '--glob.test', '.tmp/worker-cleanup/leaked-worker.test.ts'],
        5_000,
      )

      assert.equal(result.code, 0, result.output)
      assert.match(result.output, /pass 1/)
    } finally {
      await fsp.rm(FIXTURE_DIR, { recursive: true, force: true })
    }
  })
})
