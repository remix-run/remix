import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { addHeadingIds } from './headings.ts'
import { parseMarkdownDocument } from './parser.ts'
import { renderMarkdownHtml } from './render.ts'

describe('renderMarkdownHtml', () => {
  it('preserves raw HTML', async () => {
    let { root } = parseMarkdownDocument(
      '# Example\n\n<section data-example="raw"><p>Rendered HTML</p></section>\n',
    )
    addHeadingIds(root)

    let html = await renderMarkdownHtml(root)

    assert.match(html, /<section data-example="raw"><p>Rendered HTML<\/p><\/section>/)
  })

  it('renders linked headings and transforms links', async () => {
    let { root } = parseMarkdownDocument('## Details\n\n[API](/api/example/)\n')
    addHeadingIds(root)

    let html = await renderMarkdownHtml(root, {
      transformLink(href) {
        return href.startsWith('/api/') ? `/v1${href}` : undefined
      },
    })

    assert.match(
      html,
      /<h2 id="details"><a class="docs-heading-link" href="#details">Details<\/a><\/h2>/,
    )
    assert.match(html, /<a href="\/v1\/api\/example\/">API<\/a>/)
  })

  it('wraps tables in horizontal scrollers', async () => {
    let { root } = parseMarkdownDocument(
      '| Name | Description |\n| --- | --- |\n| Remix | Web framework |\n',
    )

    let html = await renderMarkdownHtml(root)

    assert.match(html, /^<div class="docs-table-scroll"><table>.*<\/table><\/div>$/s)
  })

  it('wraps each h2 and its content in a section when enabled', async () => {
    let { root } = parseMarkdownDocument(
      '# Title\n\nIntro.\n\n## First\n\nOne.\n\n### Detail\n\nTwo.\n\n## Second\n\nThree.\n',
    )
    addHeadingIds(root)

    let html = await renderMarkdownHtml(root, { sections: true })

    assert.match(html, /^<h1 id="title">.*<\/h1>\n<p>Intro\.<\/p>\n<section class="docs-section">/s)
    assert.match(
      html,
      /<section class="docs-section"><h2 id="first">.*<\/h2>\n<p>One\.<\/p>\n<h3 id="detail">.*<\/h3>\n<p>Two\.<\/p>\n<\/section>/s,
    )
    assert.match(
      html,
      /<section class="docs-section"><h2 id="second">.*<p>Three\.<\/p><\/section>$/s,
    )
  })

  it('does not wrap sections by default', async () => {
    let { root } = parseMarkdownDocument('## First\n\nOne.\n')

    let html = await renderMarkdownHtml(root)

    assert.doesNotMatch(html, /<section/)
  })

  it('renders disabled links as text', async () => {
    let { root } = parseMarkdownDocument('[Published](/published/) [Draft](/draft/)\n')

    let html = await renderMarkdownHtml(root, {
      transformLink(href) {
        return href === '/draft/' ? null : undefined
      },
    })

    assert.equal(html, '<p><a href="/published/">Published</a> <span>Draft</span></p>')
  })

  it('renders GitHub alerts as notices', async () => {
    let { root } = parseMarkdownDocument('> [!NOTE]\n> Read this **first**.\n>\n> Then this.\n')

    let html = await renderMarkdownHtml(root)

    assert.match(html, /^<aside class="docs-notice" data-notice="note" aria-label="Note"><svg/)
    assert.match(
      html,
      /<div class="docs-notice__content">\n?<p>Read this <strong>first<\/strong>\.<\/p>\n<p>Then this\.<\/p>\n?<\/div><\/aside>$/,
    )
    assert.doesNotMatch(html, /\[!NOTE\]|<blockquote/)
  })

  it('renders warning alerts with the warning notice type', async () => {
    let { root } = parseMarkdownDocument('> [!WARNING]\n> Back up your database first.\n')

    let html = await renderMarkdownHtml(root)

    assert.match(html, /data-notice="warning" aria-label="Warning"/)
    assert.match(html, /<p>Back up your database first\.<\/p>/)
  })

  it('leaves ordinary blockquotes alone', async () => {
    let { root } = parseMarkdownDocument('> [NOTE] is not an alert marker.\n')

    let html = await renderMarkdownHtml(root)

    assert.match(html, /^<blockquote>\n<p>\[NOTE\] is not an alert marker\.<\/p>\n<\/blockquote>$/)
  })

  it('requires the alert marker on its own line, like GitHub', async () => {
    let { root } = parseMarkdownDocument('> [!NOTE] Text on the same line.\n')

    let html = await renderMarkdownHtml(root)

    assert.match(html, /^<blockquote>/)
  })
})
