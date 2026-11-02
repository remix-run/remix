import type { ContainerDirective, LeafDirective } from 'mdast-util-directive'
import type { Nodes, Root, RootContent } from 'mdast'
import { visit } from 'unist-util-visit'
import { parseMarkdownRoot } from 'remix-docs-shared/markdown/parser'

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

// Replaces each ::frame directive with the markdown returned by `resolve`. Everything
// else is left byte-for-byte intact.
export async function replaceMarkdownFrames(
  source: string,
  resolve: (src: string) => Promise<string>,
): Promise<string> {
  // Match parseMarkdownRoot's newline normalization so node offsets line up.
  let normalized = source.replace(/\r\n?/g, '\n')
  let frames: { start: number; end: number; src: string }[] = []

  visit(parseMarkdownRoot(normalized), (node) => {
    if (!isFrameDirective(node)) {
      return
    }

    let src = readFrameSrc(node)
    let start = node.position?.start.offset
    let end = node.position?.end.offset
    if (src !== undefined && start !== undefined && end !== undefined) {
      frames.push({ start, end, src })
    }
  })

  let result = normalized
  for (let { start, end, src } of frames.reverse()) {
    let replacement = await resolve(src)
    // Drop the blank line that followed a removed frame.
    let tail = replacement === '' ? result.slice(end).replace(/^\n+/, '') : result.slice(end)
    result = result.slice(0, start) + replacement + tail
  }

  return result
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
