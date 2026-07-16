import type { Root } from 'mdast'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective)

export function parseMarkdownRoot(source: string): Root {
  source = source.replace(/\r\n?/g, '\n')
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
