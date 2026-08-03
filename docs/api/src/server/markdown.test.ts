import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it, type TestContext } from 'remix/test'

import { renderMarkdownFile } from './markdown.ts'

describe('renderMarkdownFile()', () => {
  it('adds linked heading IDs and collects h2 and h3 headings for the table of contents', async (t) => {
    let result = await renderMarkdown(
      t,
      '# API Name\n\n## Summary\n\n### Detail\n\n## Summary\n\n## `Code` and *emphasis*\n',
    )

    assert.equal(result.html.includes('<h1 id="api-name">'), true)
    assert.equal(result.html.includes('class="docs-heading-link" href="#summary"'), true)
    assert.equal(result.headings.length, 4)
    assert.deepEqual(result.headings[0], {
      id: 'summary',
      depth: 2,
      title: 'Summary',
      titleHtml: 'Summary',
    })
    assert.deepEqual(result.headings[1], {
      id: 'detail',
      depth: 3,
      title: 'Detail',
      titleHtml: 'Detail',
    })
    assert.equal(result.headings[2].id, 'summary-1')
    assert.deepEqual(result.headings[3], {
      id: 'code-and-emphasis',
      depth: 2,
      title: 'Code and emphasis',
      titleHtml: '<code>Code</code> and <em>emphasis</em>',
    })
  })

  it('renders highlighted code blocks with the shared copy contract', async (t) => {
    let result = await renderMarkdown(t, '```ts\nlet count = 1\n```\n')

    assert.match(result.html, /<div class="docs-code-block" data-code-block>/)
    assert.match(result.html, /<pre class="shiki shiki-themes github-light github-dark"/)
    assert.match(result.html, /<button[^>]*data-code-block-copy/)
    assert.match(result.html, /aria-label="Copy code to clipboard"/)
  })

  it('uses and removes explicit heading IDs', async (t) => {
    let result = await renderMarkdown(t, '## Custom title {#custom-id}\n')

    assert.deepEqual(result.headings, [
      {
        id: 'custom-id',
        depth: 2,
        title: 'Custom title',
        titleHtml: 'Custom title',
      },
    ])
    assert.equal(result.html.includes('<h2 id="custom-id">'), true)
    assert.equal(result.html.includes('{#custom-id}'), false)
  })
})

async function renderMarkdown(t: TestContext, source: string) {
  let directory = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-docs-markdown-'))
  let file = path.join(directory, 'page.md')
  fs.writeFileSync(file, source)
  t.after(() => fs.rmSync(directory, { recursive: true }))

  return renderMarkdownFile(file, new Map(), undefined, false)
}
