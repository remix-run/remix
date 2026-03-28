import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from 'node:test'

import { run } from './cli.ts'

describe('remix CLI wrapper', () => {
  it('uses the wrapper package version as the default scaffold version', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-wrapper-'))

    try {
      let appDir = path.join(tmpDir, 'my-app')
      let exitCode = await run(['new', appDir])

      assert.equal(exitCode, 0)

      let packageJson = JSON.parse(
        await fs.readFile(path.join(appDir, 'package.json'), 'utf8'),
      ) as {
        dependencies: Record<string, string>
      }

      assert.equal(packageJson.dependencies.remix, '3.0.0-alpha.4')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})
