import type { ShikiTransformer } from 'shiki'

export type MarkdownHeading = {
  id: string
  depth: 2 | 3
  title: string
  titleHtml: string
}

export type CodeBlock = {
  source: string
  language?: string
  meta?: string
}

export type CodeBlockInfo = {
  language: string
  filename?: string
  highlightedLines: Set<number>
}

export type HighlightCodeOptions = {
  includeExplanation?: boolean
  transformers?: ShikiTransformer[]
}

export type MarkdownHtmlOptions = {
  highlightCode?: HighlightCodeOptions
  /** Wraps each `h2` and the content that follows it in a `<section class="docs-section">`. */
  sections?: boolean
  transformLink?: (href: string) => string | null | undefined
}
