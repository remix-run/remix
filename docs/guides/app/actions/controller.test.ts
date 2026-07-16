import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createGuidesRouter } from '../router.ts'
import { routes } from '../routes.ts'

describe('root controller assets', () => {
  it('serves an existing prerendered Pagefind asset in development', async (t) => {
    let pagefindAssetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-guides-pagefind-'))
    t.after(() => fs.rm(pagefindAssetsDir, { recursive: true, force: true }))
    await fs.writeFile(
      path.join(pagefindAssetsDir, 'pagefind-component-ui.js'),
      'export const search = true\n',
    )
    let router = createGuidesRouter({ pagefindAssetsDir })

    let response = await router.fetch(
      new Request(
        new URL(
          routes.assets.href({ path: 'pagefind/pagefind-component-ui.js' }),
          'http://localhost',
        ),
      ),
    )

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /javascript/)
    assert.equal(await response.text(), 'export const search = true\n')
  })

  it('returns no content for a Pagefind asset that has not been prerendered', async (t) => {
    let pagefindAssetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-guides-pagefind-'))
    t.after(() => fs.rm(pagefindAssetsDir, { recursive: true, force: true }))
    let router = createGuidesRouter({ pagefindAssetsDir })

    let response = await router.fetch(
      new Request(
        new URL(
          routes.assets.href({ path: 'pagefind/pagefind-component-ui.js' }),
          'http://localhost',
        ),
      ),
    )

    assert.equal(response.status, 204)
  })
})
