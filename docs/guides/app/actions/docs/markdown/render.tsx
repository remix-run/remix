import type { Root } from 'mdast'
import { Frame } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'
import { addHeadingIds, readMarkdownHeadingsFromRoot } from 'remix-docs-shared/markdown/headings'
import { parseMarkdownDocument } from 'remix-docs-shared/markdown/parser'
import { renderMarkdownHtml } from 'remix-docs-shared/markdown/render'
import { docsMarkdownContentCss } from 'remix-docs-shared/ui/markdown-content'

import { readChapterMetadata } from './frontmatter.ts'
import { splitMarkdownRoot } from './frames.ts'
import type { MarkdownChapter, MarkdownChapterSummary, MarkdownOptions } from './types.ts'

export async function renderMarkdownChapter(
  source: string,
  options: MarkdownOptions,
): Promise<MarkdownChapter> {
  let { attributes, root } = readMarkdownDocument(source)

  return {
    ...readChapterMetadata(attributes, options),
    sections: readMarkdownHeadingsFromRoot(root),
    content: await renderMarkdownRoot(root),
  }
}

export function readMarkdownChapterSummary(
  source: string,
  options: MarkdownOptions,
): MarkdownChapterSummary {
  let { attributes, root } = readMarkdownDocument(source)

  return {
    ...readChapterMetadata(attributes, options),
    sections: readMarkdownHeadingsFromRoot(root),
  }
}

function readMarkdownDocument(source: string): {
  attributes: Record<string, unknown>
  root: Root
} {
  let { attributes, root } = parseMarkdownDocument(source)
  addHeadingIds(root)

  return { attributes, root }
}

async function renderMarkdownRoot(root: Root): Promise<RemixNode[]> {
  let nodes: RemixNode[] = []
  let definitions = root.children.filter(
    (child) => child.type === 'definition' || child.type === 'footnoteDefinition',
  )

  for (let segment of splitMarkdownRoot(root)) {
    if (segment.type === 'frame') {
      nodes.push(<Frame key={`frame-${segment.lineNumber}`} src={segment.src} />)
      continue
    }

    let segmentRoot: Root = {
      type: 'root',
      children: [...definitions, ...segment.children],
    }
    nodes.push(
      <MarkdownHtml
        key={`markdown-${segment.lineNumber}-${nodes.length}`}
        html={await renderMarkdownHtml(segmentRoot)}
      />,
    )
  }

  return nodes
}

function MarkdownHtml(handle: Handle<{ html: string }>) {
  return () => (
    <div class="rmx-page-body" mix={docsMarkdownContentCss} innerHTML={handle.props.html} />
  )
}
