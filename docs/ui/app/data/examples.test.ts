import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderMarkdownHtml } from 'remix-docs-shared/markdown/render'
import { highlightSource } from './examples.tsx'

describe('highlightSource', () => {
  it('removes outer whitespace and shared indentation while keeping inner formatting', async () => {
    let html = await highlightSource(`

      function Example() {
        let label = 'Hello'

        return () => <button>{label}</button>
      }

    `)
    let expected =
      "function Example() {\n  let label = 'Hello'\n\n  return () => <button>{label}</button>\n}"
    assert.equal(html, await renderSource(expected))
    assert.match(html, /data-code-block-copy/)
  })

  it('removes shared tabs without flattening nested code', async () => {
    let html = await highlightSource('\n\t\tfunction run() {\n\t\t\treturn 1\n\t\t}\n\t')
    assert.equal(html, await renderSource('function run() {\n\treturn 1\n}'))
  })

  it('keeps indentation when the snippet already starts at the left edge', async () => {
    let source = 'function run() {\n  return 1\n}'
    assert.equal(await highlightSource(source), await renderSource(source))
  })

  it('trims a single line and uses the requested language', async () => {
    let html = await highlightSource('  npm i remix  ', 'sh')
    assert.equal(html, await renderSource('npm i remix', 'sh'))
  })

  it('renders empty and whitespace-only snippets as empty code blocks', async () => {
    let expected = await renderSource('')
    assert.equal(await highlightSource(''), expected)
    assert.equal(await highlightSource(' \n\t\n  '), expected)
  })
})

function renderSource(value: string, lang = 'tsx') {
  return renderMarkdownHtml({ type: 'root', children: [{ type: 'code', lang, value }] })
}
