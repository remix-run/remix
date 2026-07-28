import matter from 'gray-matter'
import type { Element, Root as HastRoot } from 'hast'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { Frame } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'

import { rehypeHighlightCode } from './code-blocks.ts'
import { escapeMarkdownHtml } from './html-escape.ts'
import { addHeadingIds, readMarkdownSectionsFromRoot } from './headings.ts'
import { parseMarkdownRoot } from './parser.ts'
import { readChapterMetadata } from './frontmatter.ts'
import { splitMarkdownRoot } from './frames.ts'
import type { Root } from 'mdast'
import type { MarkdownChapter, MarkdownChapterSummary, MarkdownOptions } from './types.ts'

const markdownHtmlProcessor = unified()
  .use(remarkRehype)
  .use(rehypeLinkHeadings)
  .use(rehypeHighlightCode)
  .use(rehypeStringify)

export async function renderMarkdownChapter(
  source: string,
  options: MarkdownOptions,
): Promise<MarkdownChapter> {
  let { attributes, root } = readMarkdownDocument(source)

  return {
    ...readChapterMetadata(attributes, options),
    sections: readMarkdownSectionsFromRoot(root),
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
    sections: readMarkdownSectionsFromRoot(root),
  }
}

function readMarkdownDocument(source: string): {
  attributes: Record<string, unknown>
  root: Root
} {
  let parsed = matter(source)
  let root = parseMarkdownRoot(parsed.content)

  escapeMarkdownHtml(root)
  addHeadingIds(root)

  return { attributes: parsed.data, root }
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
    let hast = await markdownHtmlProcessor.run(segmentRoot)

    nodes.push(
      <MarkdownHtml
        key={`markdown-${segment.lineNumber}-${nodes.length}`}
        html={markdownHtmlProcessor.stringify(hast)}
      />,
    )
  }

  return nodes
}

function MarkdownHtml(handle: Handle<{ html: string }>) {
  return () => <div class="rmx-page-body" innerHTML={handle.props.html} />
}

function rehypeLinkHeadings() {
  return function transform(tree: HastRoot): void {
    visit(tree, 'element', (node) => {
      if (!/^h[1-6]$/.test(node.tagName)) {
        return
      }

      let id = node.properties.id
      if (typeof id !== 'string' || id.trim() === '') {
        return
      }

      if (hasAnchorDescendant(node)) {
        return
      }

      node.children = [
        {
          type: 'element',
          tagName: 'a',
          properties: {
            class: 'docs-heading-link',
            href: `#${id}`,
          },
          children: node.children,
        },
      ]
    })
  }
}

function hasAnchorDescendant(node: Element): boolean {
  for (let child of node.children) {
    if (child.type !== 'element') {
      continue
    }

    if (child.tagName === 'a' || hasAnchorDescendant(child)) {
      return true
    }
  }

  return false
}
