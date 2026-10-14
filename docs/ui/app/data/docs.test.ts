import { readFile } from 'node:fs/promises'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import accordionDocs from '../../../../packages/ui/src/accordion.docs.tsx'
import uiPackage from '../../../../packages/ui/package.json' with { type: 'json' }
import { isUiDocs, loadDocs } from './docs.ts'
import { loadExample } from './examples.tsx'

describe('UI docs definitions', () => {
  it('discovers co-located definitions and their readable examples', async () => {
    let pages = await loadDocs()
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
    await Promise.all(
      pages.flatMap((page) =>
        page.examples.map(async (example) => {
          let source = await readFile(example.module, 'utf8')
          assert.match(source, /export default function/)
          assert.match(source, /@remix-run\/ui\//)
        }),
      ),
    )
  })

  it('rejects invalid categories and example module URLs', () => {
    assert.equal(isUiDocs(accordionDocs), true)
    assert.equal(isUiDocs({ ...accordionDocs, category: 'system' }), false)
    assert.equal(
      isUiDocs({
        ...accordionDocs,
        examples: [
          { ...accordionDocs.examples[0], module: new URL('https://example.com/demo.tsx') },
        ],
      }),
      false,
    )
    assert.equal(
      isUiDocs({
        ...accordionDocs,
        examples: [{ ...accordionDocs.examples[0], module: new URL('file:///demo.tsx#default') }],
      }),
      false,
    )
  })

  it('documents every public UI entry point', async () => {
    let pages = await loadDocs()
    let documentedImports = new Set(pages.map((page) => page.importPath))
    for (let entry of Object.keys(uiPackage.exports)) {
      if (entry === './package.json') continue
      assert.ok(documentedImports.has(`@remix-run/ui/${entry.slice(2)}`))
    }
  })

  it('rejects malformed section snippets and associations', () => {
    assert.equal(
      isUiDocs({
        ...accordionDocs,
        sections: [{ id: 'state', title: 'State', content() {}, code: [{ source: 42 }] }],
      }),
      false,
    )
    assert.equal(
      isUiDocs({ ...accordionDocs, examples: [{ ...accordionDocs.examples[0], section: 42 }] }),
      false,
    )
  })

  it('loads the component and displays its source without rewriting imports', async () => {
    let example = await loadExample(accordionDocs.examples[0])
    assert.equal(typeof example.Component, 'function')
    assert.match(example.sourceHtml, /remix\/component/)
    assert.match(example.sourceHtml, /@remix-run\/ui\/accordion/)
    assert.match(example.sourceHtml, /data-code-block-copy/)
  })
})
