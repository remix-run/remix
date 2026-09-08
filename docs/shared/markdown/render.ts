import type { Element, Root as HastRoot } from 'hast'
import type { Root } from 'mdast'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { rehypeHighlightCode } from './code-blocks.ts'
import type { MarkdownHtmlOptions } from './types.ts'

export async function renderMarkdownHtml(
  root: Root,
  options: MarkdownHtmlOptions = {},
): Promise<string> {
  let processor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeLinkHeadings)
    .use(rehypeHighlightCode, options.highlightCode ?? {})
    .use(rehypeTransformLinks, { transformLink: options.transformLink })
    .use(rehypeStringify, { allowDangerousHtml: true })
  let hast = await processor.run(root)
  return processor.stringify(hast)
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
      if (href !== undefined) {
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
