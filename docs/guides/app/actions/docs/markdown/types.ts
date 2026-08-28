import type { RootContent } from 'mdast'

import type { RemixNode } from 'remix/ui'
import type { MarkdownHeading } from 'remix-docs-shared/markdown/types'

export type MarkdownOptions = {
  chapter: string
  filePath?: string
}

export type MarkdownChapter = {
  chapter: string
  title: string
  description: string
  sections: MarkdownHeading[]
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
