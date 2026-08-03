import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { discoverBrowserAssetHrefs } from './browser-assets.ts'

describe('discoverBrowserAssetHrefs()', () => {
  it('discovers browser modules and demos with their preloads', async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-docs-browser-assets-'))

    try {
      let appDir = path.join(tempDir, 'app')
      let sharedDir = path.join(tempDir, 'shared')
      await Promise.all([
        writeFile(path.join(appDir, 'entry.browser.ts')),
        writeFile(path.join(appDir, 'example.demo.tsx')),
        writeFile(path.join(appDir, 'entry.test.browser.ts')),
        writeFile(path.join(appDir, 'dev-refresh.browser.ts')),
        writeFile(path.join(sharedDir, 'shell.browser.tsx')),
      ])

      let hrefs = await discoverBrowserAssetHrefs(
        {
          async getHref(filePath) {
            return `/assets/${path.basename(filePath)}`
          },
          async getPreloads(filePath) {
            let filePaths = typeof filePath === 'string' ? [filePath] : filePath
            return filePaths.map((filePath) => `/preloads/${path.basename(filePath)}.js`)
          },
        },
        [
          {
            rootDir: appDir,
            patterns: ['**/*.browser.ts', '**/*.browser.tsx', '**/*.demo.tsx'],
          },
          {
            rootDir: sharedDir,
            patterns: ['**/*.browser.ts', '**/*.browser.tsx'],
          },
        ],
      )

      assert.deepEqual(hrefs, [
        '/assets/entry.browser.ts',
        '/assets/example.demo.tsx',
        '/assets/shell.browser.tsx',
        '/preloads/entry.browser.ts.js',
        '/preloads/example.demo.tsx.js',
        '/preloads/shell.browser.tsx.js',
      ])
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})

async function writeFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, '')
}
