import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { parseMarkdownDocument, parseMarkdownFrontmatter } from './parser.ts'

describe('parseMarkdownFrontmatter', () => {
  it('separates typed attributes from the Markdown body', () => {
    let source = '---\ntitle: Example\nsource: https://example.com/source.ts\n---\n\n# Body\n'
    let result = parseMarkdownFrontmatter(source)

    assert.deepEqual(result.attributes, {
      title: 'Example',
      source: 'https://example.com/source.ts',
    })
    assert.equal(result.body, '\n# Body\n')
  })
})

describe('parseMarkdownDocument', () => {
  it('parses the frontmatter body into a Markdown root', () => {
    let result = parseMarkdownDocument('---\ntitle: Example\n---\n\n# Body\n')

    assert.equal(result.root.children.length, 1)
    assert.equal(result.root.children[0].type, 'heading')
  })
})
