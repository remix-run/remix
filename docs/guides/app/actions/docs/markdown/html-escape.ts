import type { Html, Paragraph, Root } from 'mdast'
import { visit } from 'unist-util-visit'

import type { Text } from 'mdast'

// Raw HTML in guide markdown is escaped, not executed, so embedded markup shows
// up literally. At the document root it's wrapped in a paragraph to stay a valid block.
export function escapeMarkdownHtml(root: Root): void {
  visit(root, 'html', (node, index, parent) => {
    if (parent === undefined || index === undefined) {
      return
    }

    let htmlNode: Html = node
    let text: Text = {
      type: 'text',
      value: htmlNode.value,
      position: htmlNode.position,
    }

    if (parent.type === 'root') {
      let paragraph: Paragraph = {
        type: 'paragraph',
        children: [text],
        position: htmlNode.position,
      }
      parent.children[index] = paragraph
      return
    }

    parent.children[index] = text
  })
}
