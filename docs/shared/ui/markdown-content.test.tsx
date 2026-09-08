import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { docsMarkdownContentCss } from './markdown-content.ts'

describe('docsMarkdownContentCss', () => {
  it('serializes the shared prose mix', async () => {
    let html = await renderToString(
      <div mix={docsMarkdownContentCss}>
        <h2>Heading</h2>
        <p>Paragraph</p>
      </div>,
    )

    assert.match(html, /class="[^"]+"/)
    assert.doesNotMatch(html, /\[object Object\]/)
  })
})
