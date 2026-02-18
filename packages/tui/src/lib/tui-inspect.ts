import type { TuiContainerNode, TuiNode } from './tui-node-policy.ts'

export function stringifyTuiTree(node: TuiContainerNode | TuiNode): string {
  if (node.kind === 'container') {
    return node.children.map((child) => stringifyTuiTree(child)).join('')
  }
  if (node.kind === 'text') {
    return node.host.text
  }
  let children = node.children.map((child) => stringifyTuiTree(child)).join('')
  return `<${node.type}>${children}</${node.type}>`
}
