import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { escapeMarkdownHtml } from './html-escape.ts'
import { parseMarkdownRoot } from './parser.ts'

describe('escapeMarkdownHtml', () => {
  it('replaces a block-level raw HTML node with a paragraph of escaped text', () => {
    let root = parseMarkdownRoot('<div>raw</div>\n')
    escapeMarkdownHtml(root)

    let paragraph = root.children[0]
    assert.equal(paragraph.type, 'paragraph')
    if (paragraph.type === 'paragraph') {
      assert.equal(paragraph.children[0].type, 'text')
      assert.equal((paragraph.children[0] as { value: string }).value, '<div>raw</div>')
    }
  })

  it('replaces an inline raw HTML node with plain text nodes', () => {
    let root = parseMarkdownRoot('Before <span>raw</span> after\n')
    escapeMarkdownHtml(root)

    let paragraph = root.children[0]
    assert.equal(paragraph.type, 'paragraph')
    if (paragraph.type === 'paragraph') {
      // remark splits raw inline HTML into separate html nodes; each becomes text,
      // so the markup shows up literally instead of being interpreted.
      let values = paragraph.children.map((c) => (c.type === 'text' ? c.value : ''))
      assert.deepEqual(values, ['Before ', '<span>', 'raw', '</span>', ' after'])
    }
  })

  it('leaves markdown without raw HTML untouched', () => {
    let root = parseMarkdownRoot('# Title\n\nA normal paragraph.\n')
    let before = JSON.stringify(root)
    escapeMarkdownHtml(root)
    assert.equal(JSON.stringify(root), before)
  })
})
