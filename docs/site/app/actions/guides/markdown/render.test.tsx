import * as assert from 'remix/assert'
import { renderToStream } from 'remix/component/server'
import { describe, it } from 'remix/test'

import { renderMarkdownChapter } from './render.tsx'

describe('renderMarkdownChapter', () => {
  it('wraps each h2 section, including frames inside it, in a docs section', async () => {
    let source = [
      '---',
      'title: Example',
      'description: An example chapter.',
      '---',
      '',
      'Intro paragraph.',
      '',
      '## First',
      '',
      'Before the demo.',
      '',
      '::frame{src="/examples/demo/"}',
      '',
      'After the demo.',
      '',
      '## Second',
      '',
      'Closing paragraph.',
      '',
    ].join('\n')

    let chapter = await renderMarkdownChapter(source, { chapter: 'Chapter 1' })
    let html = await new Response(
      renderToStream(<div>{chapter.content}</div>, {
        resolveFrame: () => '<p>Demo content</p>',
      }),
    ).text()

    let intro = html.indexOf('Intro paragraph.')
    let [first, second] = html.split('<section class="docs-section">').slice(1)

    assert.ok(intro !== -1 && intro < html.indexOf('<section'))
    assert.match(first, /id="first"/)
    assert.match(first, /Before the demo\..*Demo content.*After the demo\..*<\/section>/s)
    assert.doesNotMatch(first, /Closing paragraph/)
    assert.match(second, /id="second".*Closing paragraph\./s)
  })
})
