import type { Root, RootContent } from 'mdast'
import { Frame, unsafeHTML } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { addHeadingIds, readMarkdownHeadingsFromRoot } from 'remix-docs-shared/markdown/headings'
import { parseMarkdownDocument } from 'remix-docs-shared/markdown/parser'
import { renderMarkdownHtml } from 'remix-docs-shared/markdown/render'
import { groupMarkdownSections } from 'remix-docs-shared/markdown/sections'
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
    content: await renderMarkdownRoot(root, options.disabledLinkPaths),
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

async function renderMarkdownRoot(
  root: Root,
  disabledLinkPaths: ReadonlySet<string> | undefined,
): Promise<RemixNode[]> {
  let definitions = root.children.filter(
    (child) => child.type === 'definition' || child.type === 'footnoteDefinition',
  )
  let { intro, sections } = groupMarkdownSections(
    root.children,
    (child) => child.type === 'heading' && child.depth === 2,
  )
  let nodes = await renderMarkdownSegments(intro, definitions, disabledLinkPaths)

  for (let children of sections) {
    let lineNumber = children[0].position?.start.line ?? nodes.length
    nodes.push(
      <section key={`section-${lineNumber}`} class="docs-section">
        {await renderMarkdownSegments(children, definitions, disabledLinkPaths)}
      </section>,
    )
  }

  return nodes
}

async function renderMarkdownSegments(
  children: RootContent[],
  definitions: RootContent[],
  disabledLinkPaths: ReadonlySet<string> | undefined,
): Promise<RemixNode[]> {
  let nodes: RemixNode[] = []

  for (let segment of splitMarkdownRoot({ type: 'root', children })) {
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
        html={await renderMarkdownHtml(segmentRoot, {
          transformLink(href) {
            let pathname = getRootRelativePathname(href)
            return pathname !== undefined && disabledLinkPaths?.has(pathname) ? null : undefined
          },
        })}
      />,
    )
  }

  return nodes
}

function getRootRelativePathname(href: string): string | undefined {
  if (!href.startsWith('/') || href.startsWith('//')) {
    return undefined
  }

  return new URL(href, 'http://localhost').pathname
}

function MarkdownHtml(handle: Handle<{ html: string }>) {
  return () => (
    <div
      class="rmx-page-body"
      mix={docsMarkdownContentCss}
      innerHTML={unsafeHTML(handle.props.html)}
    />
  )
}
