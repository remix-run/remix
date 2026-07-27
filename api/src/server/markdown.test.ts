import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it, type TestContext } from 'remix/test'

import { renderMarkdownFile } from './markdown.ts'

describe('renderMarkdownFile()', () => {
  it('adds linked heading IDs and collects h2 headings for the table of contents', async (t) => {
    let result = await renderMarkdown(
      t,
      '# API Name\n\n## Summary\n\n### Detail\n\n## Summary\n\n## `Code` and *emphasis*\n',
    )

    assert.equal(result.html.includes('<h1 id="api-name">'), true)
    assert.equal(result.html.includes('class="docs-heading-link" href="#summary"'), true)
    assert.equal(result.headings.length, 3)
    assert.deepEqual(result.headings[0], {
      id: 'summary',
      title: 'Summary',
      titleHtml: 'Summary',
    })
    assert.equal(result.headings[1].id, 'summary-1')
    assert.deepEqual(result.headings[2], {
      id: 'code-and-emphasis',
      title: 'Code and emphasis',
      titleHtml: '<code>Code</code> and <em>emphasis</em>',
    })
  })

  it('uses and removes explicit heading IDs', async (t) => {
    let result = await renderMarkdown(t, '## Custom title {#custom-id}\n')

    assert.deepEqual(result.headings, [
      {
        id: 'custom-id',
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
