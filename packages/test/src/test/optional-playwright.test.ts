import { execFile } from 'node:child_process'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, it } from '../lib/framework.ts'
import { IS_BUN } from '../lib/runtime.ts'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const execFileAsync = promisify(execFile)
const BLOCK_PLAYWRIGHT_HOOK = `data:text/javascript,${encodeURIComponent(`
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'playwright' || specifier === 'playwright/test') {
      throw new Error('Server tests must not load Playwright')
    }

    return nextResolve(specifier, context)
  },
})
`)}`

describe('optional Playwright dependency', () => {
  it('runs server tests without loading Playwright', { skip: IS_BUN }, async () => {
    let nodeOptions = [process.env.NODE_OPTIONS, `--import=${BLOCK_PLAYWRIGHT_HOOK}`]
      .filter(Boolean)
      .join(' ')

    await execFileAsync(
      process.execPath,
      [
        '../remix/src/cli-entry.ts',
        'test',
        '--type',
        'server',
        '--glob.test',
        'src/test/config.test.ts',
        '--quiet',
      ],
      {
        cwd: PKG_DIR,
        env: { ...process.env, NODE_OPTIONS: nodeOptions },
      },
    )
  })
})
