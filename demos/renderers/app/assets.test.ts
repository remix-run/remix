import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from './router.ts'
import { assets, preactEntry, reactEntry } from './utils/assets.ts'

describe('browser assets', () => {
  it('serves the Preact entry graph from source and node_modules', async () => {
    let hrefs = await assets.getPreloads(preactEntry)

    // Hrefs are fingerprinted outside development, so match on the source path only.
    assert.ok(hrefs.some((href) => href.includes('/preact/dist/preact.module.')))
    assert.ok(hrefs.some((href) => href.includes('/preact/hooks/dist/hooks.module.')))
    assert.ok(hrefs.some((href) => href.includes('/app/actions/preact/public/entry-form.')))
    assert.ok(hrefs.some((href) => href.includes('/app/utils/public/validate-entry.')))

    for (let href of hrefs) {
      let response = await router.fetch(new Request(new URL(href, 'http://localhost')))
      assert.equal(response.status, 200, href)
    }
  })

  it('leaves React specifiers external for the import map', async () => {
    let hrefs = await assets.getPreloads(reactEntry)

    assert.ok(hrefs.some((href) => href.includes('/app/actions/react/public/entry-form.')))
    assert.ok(!hrefs.some((href) => href.startsWith('/assets/npm/')))

    let entryHref = await assets.getHref(reactEntry)
    let entry = await router.fetch(new Request(new URL(entryHref, 'http://localhost')))
    let source = await entry.text()
    assert.match(source, /from\s*"react-dom\/client"/)
    assert.match(source, /from\s*"react\/jsx-runtime"/)
  })

  it('rejects server-only source', async () => {
    let preact = await router.fetch(
      new Request('http://localhost/assets/app/actions/preact/controller.tsx'),
    )
    let react = await router.fetch(
      new Request('http://localhost/assets/app/actions/react/controller.tsx'),
    )

    assert.equal(preact.status, 404)
    assert.equal(react.status, 404)
  })
})
