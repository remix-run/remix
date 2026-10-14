import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import uiPackage from '../../../../packages/ui/package.json' with { type: 'json' }
import { pages } from './docs.ts'
import { loadExample } from './examples.tsx'

describe('UI docs pages', () => {
  it('lists each page once in title order', () => {
    assert.deepEqual(
      pages.map((page) => `${page.category}/${page.slug}`),
      [
        'primitives/accordion',
        'primitives/anchor',
        'primitives/combobox',
        'animation/entrance-exit',
        'animation/layout',
        'primitives/listbox',
        'primitives/menu',
        'primitives/popover',
        'primitives/select',
        'animation/spring',
        'primitives/tabs',
        'primitives/toggle',
        'animation/tween',
      ],
    )
  })

  it('documents every public UI entry point', () => {
    let documentedImports = new Set(pages.map((page) => page.importPath))
    for (let entry of Object.keys(uiPackage.exports)) {
      if (entry === './package.json') continue
      assert.ok(documentedImports.has(`@remix-run/ui/${entry.slice(2)}`))
    }
  })

  it('loads the component and displays its source without rewriting imports', async () => {
    let example = await loadExample(
      new URL('../../../../packages/ui/src/accordion/basic.example.tsx', import.meta.url),
    )
    assert.equal(typeof example.Component, 'function')
    assert.match(example.sourceHtml, /remix\/component/)
    assert.match(example.sourceHtml, /@remix-run\/ui\/accordion/)
    assert.match(example.sourceHtml, /data-code-block-copy/)
  })

  it('rejects modules outside the example source directory', async () => {
    await assert.rejects(
      () => loadExample(new URL('./docs.ts', import.meta.url)),
      /Example must be a .example.tsx file inside packages\/ui\/src/,
    )
    await assert.rejects(
      () => loadExample(new URL('../../../../packages/ui/src/accordion.tsx', import.meta.url)),
      /Example must be a .example.tsx file inside packages\/ui\/src/,
    )
  })
})
