import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import uiPackage from '../../../../packages/ui/package.json' with { type: 'json' }
import { pages } from './pages.ts'
import { loadExample } from './examples.tsx'

describe('UI docs pages', () => {
  it('lists each page once in sidebar order', () => {
    assert.deepEqual(
      pages.map((page) => `${page.category}/${page.slug}`),
      [
        'patterns/accordion',
        'patterns/anchor',
        'patterns/combobox',
        'patterns/listbox',
        'patterns/menu',
        'patterns/popover',
        'patterns/select',
        'patterns/tabs',
        'patterns/toggle',
        'animation/entrance-exit',
        'animation/layout',
        'animation/reduced-motion',
        'animation/spring',
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
    let example = await loadExample('accordion/basic')
    assert.equal(typeof example.Component, 'function')
    assert.match(example.sourceHtml, /remix\/component/)
    assert.match(example.sourceHtml, /@remix-run\/ui\/accordion/)
    assert.match(example.sourceHtml, /data-code-block-copy/)
  })

  it('rejects absolute paths and parent directories in example names', async () => {
    await assert.rejects(() => loadExample('/accordion/basic'), /Invalid UI example name/)
    await assert.rejects(() => loadExample('../accordion/basic'), /Invalid UI example name/)
  })
})
