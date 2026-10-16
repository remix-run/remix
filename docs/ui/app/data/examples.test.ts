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

  it('normalizes tabs to the repository indentation style', async () => {
    let html = await highlightSource('\n\t\tfunction run() {\n\t\t\treturn 1\n\t\t}\n\t')
    assert.equal(html, await renderSource('function run() {\n  return 1\n}'))
  })

  it('formats callbacks and applies the repository quote and semicolon rules', async () => {
    let html = await highlightSource(`popover.surface({open,onHide(){open=false;
handle.update();},label: "Filters"})`)
    assert.equal(
      html,
      await renderSource(`popover.surface({
  open,
  onHide() {
    open = false
    handle.update()
  },
  label: 'Filters',
})`),
    )
  })

  it('omits defensive semicolons before standalone JSX and JSX after imports', async () => {
    assert.equal(
      await highlightSource('<button>Filters</button>'),
      await renderSource('<button>Filters</button>'),
    )
    let source = `import { toggle } from '@remix-run/ui/toggle'

<input type="checkbox" mix={toggle()} />`
    assert.equal(await highlightSource(source), await renderSource(source))
    assert.equal(
      await highlightSource('<button>Filters</button>', 'jsx'),
      await renderSource('<button>Filters</button>', 'jsx'),
    )
  })

  it('preserves semicolons needed to separate statements', async () => {
    let jsx = 'let content = render()\n;<div />'
    assert.equal(await highlightSource(jsx), await renderSource(jsx))
    let array = 'run()\n;[1, 2].forEach(log)'
    assert.equal(await highlightSource(array), await renderSource(array))
  })

  it('preserves JSX-like text inside template literals', async () => {
    let source = 'const markup = `start\n;<div />\nend`'
    assert.equal(await highlightSource(source), await renderSource(source))
  })

  it('renders the original snippet and warns when syntax prevents formatting', async (t) => {
    let warnings: string[] = []
    t.mock.method(console, 'warn', (message: string) => {
      warnings.push(message)
    })
    let source = '<button mix={'
    assert.equal(await highlightSource(`\n  ${source}\n`), await renderSource(source))
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /Displaying original source/)
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
