import type { Element, ElementContent, Root as HastRoot } from 'hast'
import type { Root } from 'mdast'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

import { rehypeHighlightCode } from './code-blocks.ts'
import { groupMarkdownSections } from './sections.ts'
import type { MarkdownHtmlOptions } from './types.ts'

export async function renderMarkdownHtml(
  root: Root,
  options: MarkdownHtmlOptions = {},
): Promise<string> {
  let processor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeWrapSections, { sections: options.sections ?? false })
    .use(rehypeWrapTables)
    .use(rehypeNotices)
    .use(rehypeLinkHeadings)
    .use(rehypeHighlightCode, options.highlightCode ?? {})
    .use(rehypeTransformLinks, { transformLink: options.transformLink })
    .use(rehypeStringify, { allowDangerousHtml: true })
  let hast = await processor.run(root)
  return processor.stringify(hast)
}

function rehypeWrapTables() {
  return function transform(tree: HastRoot): void {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table' || index === undefined || parent === undefined) {
        return
      }

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { class: 'docs-table-scroll' },
        children: [node],
      }
      return SKIP
    })
  }
}

const noticeKinds = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
} as const

type NoticeKind = keyof typeof noticeKinds

const noticeMarkerPattern = /^\[!(note|tip|important|warning|caution)\][ \t]*(?:\r?\n|$)/i

// Renders GitHub-style alerts (`> [!TIP]`) as notices, so the Markdown source still reads as an
// alert on GitHub and anywhere else the raw files are viewed.
function rehypeNotices() {
  return function transform(tree: HastRoot): void {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'blockquote' || index === undefined || parent === undefined) {
        return
      }

      let kind = removeNoticeMarker(node)
      if (kind === null) {
        return
      }

      parent.children[index] = {
        type: 'element',
        tagName: 'aside',
        properties: { class: 'docs-notice', dataKind: kind, ariaLabel: noticeKinds[kind] },
        children: [
          createNoticeIcon(),
          {
            type: 'element',
            tagName: 'div',
            properties: { class: 'docs-notice-body' },
            children: node.children,
          },
        ],
      }
      return SKIP
    })
  }
}

function removeNoticeMarker(blockquote: Element): NoticeKind | null {
  let firstParagraphIndex = blockquote.children.findIndex((child) => child.type === 'element')
  let firstParagraph = blockquote.children[firstParagraphIndex]
  if (firstParagraph?.type !== 'element' || firstParagraph.tagName !== 'p') {
    return null
  }

  let firstText = firstParagraph.children[0]
  if (firstText?.type !== 'text') {
    return null
  }

  let match = noticeMarkerPattern.exec(firstText.value)
  if (match === null) {
    return null
  }

  firstText.value = firstText.value.slice(match[0].length)
  if (firstText.value === '') {
    firstParagraph.children.shift()
  }
  if (firstParagraph.children.length === 0) {
    blockquote.children.splice(firstParagraphIndex, 1)
  }

  return match[1].toLowerCase() as NoticeKind
}

function createNoticeIcon(): Element {
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      class: 'docs-notice-icon',
      ariaHidden: 'true',
      width: '18',
      height: '18',
      viewBox: '0 0 24 24',
      fill: 'none',
    },
    children: [
      {
        type: 'element',
        tagName: 'circle',
        properties: { cx: '12', cy: '12', r: '9', stroke: 'currentColor', strokeWidth: '1.5' },
        children: [],
      },
      {
        type: 'element',
        tagName: 'path',
        properties: {
          d: 'M12 7.5v5',
          stroke: 'currentColor',
          strokeWidth: '1.5',
          strokeLinecap: 'round',
        },
        children: [],
      },
      {
        type: 'element',
        tagName: 'circle',
        properties: { cx: '12', cy: '16', r: '1', fill: 'currentColor' },
        children: [],
      },
    ],
  }
}

function rehypeWrapSections(options: { sections: boolean }) {
  return function transform(tree: HastRoot): void {
    if (!options.sections) {
      return
    }

    let { intro, sections } = groupMarkdownSections(
      tree.children,
      (node) => node.type === 'element' && node.tagName === 'h2',
    )

    tree.children = [
      ...intro,
      ...sections.map(
        (children): Element => ({
          type: 'element',
          tagName: 'section',
          properties: { class: 'docs-section' },
          children: children.filter((child): child is ElementContent => child.type !== 'doctype'),
        }),
      ),
    ]
  }
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

function rehypeTransformLinks(options: Pick<MarkdownHtmlOptions, 'transformLink'>) {
  return function transform(tree: HastRoot): void {
    let transformLink = options.transformLink
    if (transformLink === undefined) {
      return
    }

    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a' || typeof node.properties.href !== 'string') {
        return
      }

      let href = transformLink(node.properties.href)
      if (href === null) {
        node.tagName = 'span'
        node.properties = {}
      } else if (href !== undefined) {
        node.properties.href = href
      }
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
