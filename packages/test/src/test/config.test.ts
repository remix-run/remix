import * as assert from '@remix-run/assert'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { loadConfig } from '../lib/config.ts'
import { describe, it } from '../lib/framework.ts'

describe('loadConfig', () => {
  it('loads remix-test.config.ts from cwd', async () => {
    let tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'remix-test-config-'))

    try {
      await fsp.writeFile(
        path.join(tmp, 'remix-test.config.ts'),
        [
          'export default {',
          "  glob: { test: 'src/**/*.test.ts', browser: 'src/**/*.test.ts' },",
          "  type: ['browser'],",
          '}',
        ].join('\n'),
      )

      let config = await loadConfig([], tmp)

      assert.deepEqual(config.glob.test, ['src/**/*.test.ts'])
      assert.deepEqual(config.glob.browser, ['src/**/*.test.ts'])
      assert.deepEqual(config.type, ['browser'])
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true })
    }
  })
})
