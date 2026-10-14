import type { Element, Root as HastRoot } from 'hast'
import { toHtml } from 'hast-util-to-html'
import GithubSlugger from 'github-slugger'
import type { PhrasingContent, Root } from 'mdast'
import { toString as mdastToString } from 'mdast-util-to-string'
import { unified } from 'unified'
import remarkRehype from 'remark-rehype'
import { visit } from 'unist-util-visit'

import type { MarkdownHeading } from './types.ts'

const inlineHtmlProcessor = unified().use(remarkRehype, { allowDangerousHtml: true })

export function addHeadingIds(root: Root): void {
  let slugger = new GithubSlugger()

  visit(root, 'heading', (node) => {
    let lastChild = node.children.at(-1)
    let explicitId: string | undefined

    if (lastChild?.type === 'text') {
      let idMatch = /\s+\{#([^}\s]+)\}\s*$/.exec(lastChild.value)
      explicitId = idMatch?.[1]

      if (idMatch !== null) {
        let text = lastChild.value.slice(0, idMatch.index)

        if (text === '') {
          node.children.pop()
        } else {
          lastChild.value = text
        }
      }
    }

    let text = mdastToString(node).trim()
    let id = explicitId
    if (id === undefined) {
      id = slugger.slug(text || 'section')
      if (id === '') {
        id = slugger.slug('section')
      }
    }

    let hProperties = node.data?.hProperties ?? {}
    hProperties.id = id
    node.data = { ...node.data, hProperties }
  })
}

export function readMarkdownHeadingsFromRoot(root: Root): MarkdownHeading[] {
  let headings: MarkdownHeading[] = []

  visit(root, 'heading', (node) => {
    if (node.depth !== 2 && node.depth !== 3) {
      return
    }

    let id = node.data?.hProperties?.id
    headings.push({
      id: typeof id === 'string' && id.trim() !== '' ? id : 'section',
      depth: node.depth,
      title: mdastToString(node).trim(),
      titleHtml: renderInlineHtml(node.children),
    })
  })

  return headings
}

export function renderInlineHtml(children: PhrasingContent[]): string {
  let root: Root = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children,
      },
    ],
  }
  let hast = inlineHtmlProcessor.runSync(root) as HastRoot
  let paragraph = hast.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'p',
  )

  return (
    paragraph?.children.map((child) => toHtml(child, { allowDangerousHtml: true })).join('') ?? ''
  )
}
