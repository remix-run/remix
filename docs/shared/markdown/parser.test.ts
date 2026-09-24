import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  getMarkdownLinkDestinations,
  parseMarkdownDocument,
  parseMarkdownFrontmatter,
  rewriteMarkdownLinkDestinations,
} from './parser.ts'

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

describe('getMarkdownLinkDestinations', () => {
  it('finds inline links and reference definitions but not code examples or images', () => {
    let source = [
      '[Inline](/inline/)',
      '',
      '[Reference][reference]',
      '',
      '[reference]: /reference/',
      '',
      '`[Inline code](/inline-code/)`',
      '',
      '```md',
      '[Fenced code](/fenced-code/)',
      '```',
      '',
      '![Image](/image.png)',
      '',
    ].join('\n')

    assert.deepEqual(
      getMarkdownLinkDestinations(source).map(({ href, kind, line }) => ({ href, kind, line })),
      [
        { href: '/inline/', kind: 'link', line: 1 },
        { href: '/reference/', kind: 'definition', line: 5 },
      ],
    )
  })

  it('rewrites link destinations without changing examples or line endings', () => {
    let source = '[Link](/before/)\r\n\r\n`[Example](/before/)`\r\n'

    assert.equal(
      rewriteMarkdownLinkDestinations(source, (href) =>
        href === '/before/' ? '/after/' : undefined,
      ),
      '[Link](/after/)\r\n\r\n`[Example](/before/)`\r\n',
    )
  })
})
