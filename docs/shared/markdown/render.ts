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
    .use(rehypeAlerts)
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

type AlertType = 'note' | 'tip' | 'important' | 'warning' | 'caution'

const alertTypes = new Map<string, AlertType>([
  ['NOTE', 'note'],
  ['TIP', 'tip'],
  ['IMPORTANT', 'important'],
  ['WARNING', 'warning'],
  ['CAUTION', 'caution'],
])

const alertMarkerPattern = /^\[!([A-Z]+)\][^\S\n]*(?:\n|$)/i

// Renders GitHub alert blockquotes, such as `> [!NOTE]`, as notices
function rehypeAlerts() {
  return function transform(tree: HastRoot): void {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'blockquote' || index === undefined || parent === undefined) {
        return
      }

      let paragraph = node.children.find((child): child is Element => child.type === 'element')
      if (paragraph?.tagName !== 'p') return

      let marker = paragraph.children[0]
      if (marker?.type !== 'text') return

      let match = alertMarkerPattern.exec(marker.value)
      if (match === null) return

      let type = alertTypes.get(match[1].toUpperCase())
      if (type === undefined) return

      marker.value = marker.value.slice(match[0].length)
      if (marker.value === '') paragraph.children.shift()

      let content = node.children.filter(
        (child): child is ElementContent =>
          !(child === paragraph && paragraph.children.length === 0),
      )

      parent.children[index] = {
        type: 'element',
        tagName: 'aside',
        properties: {
          class: 'docs-notice',
          dataNotice: type,
          ariaLabel: type[0].toUpperCase() + type.slice(1),
        },
        children: [
          createAlertIcon(type),
          {
            type: 'element',
            tagName: 'div',
            properties: { class: 'docs-notice__content' },
            children: content,
          },
        ],
      }
      return SKIP
    })
  }
}

function createAlertIcon(type: AlertType): Element {
  let warning = type === 'warning' || type === 'caution'

  return {
    type: 'element',
    tagName: 'svg',
    properties: {
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
          d: warning ? 'M12 7.5v5' : 'M12 11v5.5',
          stroke: 'currentColor',
          strokeWidth: '1.5',
          strokeLinecap: 'round',
        },
        children: [],
      },
      {
        type: 'element',
        tagName: 'circle',
        properties: { cx: '12', cy: warning ? '16' : '8', r: '1', fill: 'currentColor' },
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
