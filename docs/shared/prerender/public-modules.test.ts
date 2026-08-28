import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { discoverPublicModuleHrefs } from './public-modules.ts'

describe('discoverPublicModuleHrefs()', () => {
  it('discovers modules inside colocated public directories with their preloads', async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-docs-public-modules-'))

    try {
      let appDir = path.join(tempDir, 'app')
      let sharedDir = path.join(tempDir, 'shared')
      await Promise.all([
        writeFile(path.join(appDir, 'actions', 'public', 'entry.ts')),
        writeFile(path.join(appDir, 'actions', 'public', 'entry.test.ts')),
        writeFile(path.join(appDir, 'actions', 'public', 'dev-refresh.ts')),
        writeFile(path.join(appDir, 'actions', 'private.ts')),
        writeFile(path.join(sharedDir, 'ui', 'public', 'shell.tsx')),
      ])

      let hrefs = await discoverPublicModuleHrefs(
        {
          async getHref(filePath) {
            return `/assets/${path.basename(filePath)}`
          },
          async getPreloads(filePath) {
            let filePaths = typeof filePath === 'string' ? [filePath] : filePath
            return filePaths.map((filePath) => `/preloads/${path.basename(filePath)}.js`)
          },
        },
        [appDir, sharedDir],
      )

      assert.deepEqual(hrefs, [
        '/assets/entry.ts',
        '/assets/shell.tsx',
        '/preloads/entry.ts.js',
        '/preloads/shell.tsx.js',
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
