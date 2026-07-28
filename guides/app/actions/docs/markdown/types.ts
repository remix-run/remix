import type { RootContent } from 'mdast'

import type { RemixNode } from 'remix/ui'

export type MarkdownOptions = {
  chapter: string
  filePath?: string
}

export type MarkdownChapterSection = {
  id: string
  title: string
  titleHtml: string
}

export type MarkdownChapter = {
  chapter: string
  title: string
  description: string
  sections: MarkdownChapterSection[]
  content: RemixNode
}

export type MarkdownChapterSummary = Omit<MarkdownChapter, 'content'>

export type MarkdownFrameReference = {
  src: string
  lineNumber: number
}

export type ChapterMetadata = Omit<MarkdownChapterSummary, 'sections'>

export type MarkdownSegment =
  | {
      type: 'markdown'
      children: RootContent[]
      lineNumber: number
    }
  | {
      type: 'frame'
      src: string
      lineNumber: number
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
