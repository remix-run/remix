import matter from 'gray-matter'
import type { Definition, Link, Root } from 'mdast'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective)

export function parseMarkdownFrontmatter(source: string): {
  attributes: Record<string, unknown>
  body: string
} {
  let parsed = matter(source)
  let attributes: unknown = parsed.data

  return {
    attributes: isRecord(attributes) ? attributes : {},
    body: parsed.content,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseMarkdownDocument(source: string): {
  attributes: Record<string, unknown>
  root: Root
} {
  let { attributes, body } = parseMarkdownFrontmatter(source)
  return { attributes, root: parseMarkdownRoot(body) }
}

export function parseMarkdownRoot(source: string): Root {
  return parseMarkdownSource(source.replace(/\r\n?/g, '\n'))
}

function parseMarkdownSource(source: string): Root {
  let tree = markdownParser.parse(source)
  let root = markdownParser.runSync(tree) as Root

  visit(root, 'textDirective', (node, index, parent) => {
    if (parent === undefined || index === undefined) {
      return
    }

    let start = node.position?.start.offset
    let end = node.position?.end.offset
    parent.children[index] = {
      type: 'text',
      value: start === undefined || end === undefined ? `:${node.name}` : source.slice(start, end),
      position: node.position,
    }
  })

  return root
}

export interface MarkdownLinkDestination {
  href: string
  kind: 'link' | 'definition'
  line: number
  startOffset: number
  endOffset: number
}

export function getMarkdownLinkDestinations(source: string): MarkdownLinkDestination[] {
  let root = parseMarkdownSource(source)
  let destinations: MarkdownLinkDestination[] = []

  function addDestination(kind: MarkdownLinkDestination['kind'], node: Link | Definition): void {
    let startOffset = node.position?.start.offset
    let endOffset = node.position?.end.offset
    let line = node.position?.start.line
    if (startOffset === undefined || endOffset === undefined || line === undefined) return

    destinations.push({ href: node.url, kind, line, startOffset, endOffset })
  }

  visit(root, 'link', (node) => addDestination('link', node))
  visit(root, 'definition', (node) => addDestination('definition', node))

  return destinations.sort((a, b) => a.startOffset - b.startOffset)
}

export function rewriteMarkdownLinkDestinations(
  source: string,
  rewriteHref: (href: string) => string | undefined,
): string {
  let replacements: Array<{ start: number; end: number; href: string }> = []

  for (let destination of getMarkdownLinkDestinations(source)) {
    let href = rewriteHref(destination.href)
    if (!href || href === destination.href) continue

    let nodeSource = source.slice(destination.startOffset, destination.endOffset)
    let marker =
      destination.kind === 'link' ? nodeSource.lastIndexOf('](') : nodeSource.indexOf(']:')
    if (marker === -1) continue

    let hrefStart = nodeSource.indexOf(destination.href, marker + 2)
    if (hrefStart === -1) continue

    let start = destination.startOffset + hrefStart
    replacements.push({ start, end: start + destination.href.length, href })
  }

  for (let replacement of replacements.reverse()) {
    source = source.slice(0, replacement.start) + replacement.href + source.slice(replacement.end)
  }
  return source
}
