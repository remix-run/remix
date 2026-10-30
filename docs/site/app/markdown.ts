import type { Root } from 'mdast'

import { addHeadingIds, readMarkdownHeadingsFromRoot } from 'remix-docs-shared/markdown/headings'
import { parseMarkdownDocument } from 'remix-docs-shared/markdown/parser'
import { renderMarkdownHtml } from 'remix-docs-shared/markdown/render'
import type { MarkdownHeading, MarkdownHtmlOptions } from 'remix-docs-shared/markdown/types'

export type ParsedMarkdown = {
  attributes: Record<string, unknown>
  root: Root
  headings: MarkdownHeading[]
}

export function parseMarkdown(source: string): ParsedMarkdown {
  let { attributes, root } = parseMarkdownDocument(source)
  addHeadingIds(root)

  return {
    attributes,
    root,
    headings: readMarkdownHeadingsFromRoot(root),
  }
}

export function renderMarkdown(root: Root, options: MarkdownHtmlOptions = {}): Promise<string> {
  return renderMarkdownHtml(root, options)
}
