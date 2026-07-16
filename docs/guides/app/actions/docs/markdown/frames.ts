import type { ContainerDirective, LeafDirective } from 'mdast-util-directive'
import type { Nodes, Root, RootContent } from 'mdast'
import { visit } from 'unist-util-visit'

import { parseMarkdownRoot } from './parser.ts'
import type { MarkdownFrameReference, MarkdownSegment } from './types.ts'

type FrameDirective = LeafDirective | ContainerDirective

export function readMarkdownFrameReferences(source: string): MarkdownFrameReference[] {
  let frames: MarkdownFrameReference[] = []
  // Parse the raw source (frontmatter included) so line numbers align with the file.
  let root = parseMarkdownRoot(source)

  visit(root, (node) => {
    if (!isFrameDirective(node)) {
      return
    }

    let src = readFrameSrc(node)
    if (src !== undefined) {
      frames.push({ src, lineNumber: node.position?.start.line ?? 1 })
    }
  })

  return frames
}

export function splitMarkdownRoot(root: Root): MarkdownSegment[] {
  let segments: MarkdownSegment[] = []
  let markdownChildren: RootContent[] = []
  let markdownStartLine = 1

  for (let child of root.children) {
    if (isFrameDirective(child)) {
      pushMarkdownSegment()
      let src = readFrameSrc(child)
      if (src !== undefined) {
        segments.push({
          type: 'frame',
          src,
          lineNumber: child.position?.start.line ?? 1,
        })
      }
      markdownStartLine = (child.position?.end.line ?? child.position?.start.line ?? 0) + 1
      continue
    }

    if (markdownChildren.length === 0) {
      markdownStartLine = child.position?.start.line ?? markdownStartLine
    }

    markdownChildren.push(child)
  }

  pushMarkdownSegment()
  return segments

  function pushMarkdownSegment(): void {
    let visibleChildren = markdownChildren.filter(
      (child) => child.type !== 'definition' && child.type !== 'footnoteDefinition',
    )
    if (visibleChildren.length > 0) {
      segments.push({
        type: 'markdown',
        children: visibleChildren,
        lineNumber: markdownStartLine,
      })
    }

    markdownChildren = []
  }
}

function isFrameDirective(node: Nodes): node is FrameDirective {
  return (
    (node.type === 'leafDirective' || node.type === 'containerDirective') && node.name === 'frame'
  )
}

function readFrameSrc(node: FrameDirective): string | undefined {
  let src = node.attributes?.src
  if (typeof src !== 'string') {
    return undefined
  }

  src = src.trim()
  return src === '' ? undefined : src
}
