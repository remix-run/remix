import type { TuiHostBridge } from '../lib/tui-host.ts'

export function createTestHostBridge(): TuiHostBridge {
  return {
    createElement(type) {
      return {
        type: 'element',
        tag: type,
        text: '',
        props: {},
      }
    },
    createText(value) {
      return {
        type: 'text',
        tag: '#text',
        text: value,
        props: {},
      }
    },
    setText(node, value) {
      node.text = value
    },
    insert() {},
    move() {},
    remove() {},
    setProp(node, key, value) {
      node.props[key] = value
    },
    removeProp(node, key) {
      delete node.props[key]
    },
  }
}
