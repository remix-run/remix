import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as assert from '@remix-run/assert'
import { describe, it } from '../lib/framework.ts'
import { loadPlaywrightConfig } from '../lib/playwright.ts'

describe('loadPlaywrightConfig', () => {
  it('loads an explicit config relative to the supplied working directory', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-playwright-config-'))

    try {
      await fs.mkdir(path.join(cwd, 'config'))
      await fs.writeFile(
        path.join(cwd, 'config', 'playwright.config.ts'),
        "export default { use: { browserName: 'firefox' } }\n",
        'utf8',
      )

      let config = await loadPlaywrightConfig('config/playwright.config.ts', cwd)

      assert.equal(config?.use?.browserName, 'firefox')
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('reports failures loading an explicit config', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-playwright-config-error-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'playwright.config.ts'),
        "throw new Error('broken playwright config')\n",
        'utf8',
      )

      await assert.rejects(loadPlaywrightConfig('missing.config.ts', cwd), /missing\.config\.ts/)
      await assert.rejects(
        loadPlaywrightConfig('playwright.config.ts', cwd),
        /broken playwright config/,
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('ignores absent automatically discovered configs', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-playwright-config-absent-'))

    try {
      assert.equal(await loadPlaywrightConfig(undefined, cwd), undefined)
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })
})
