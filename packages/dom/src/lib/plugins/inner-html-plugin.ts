import { definePlugin } from '@remix-run/reconciler'

export const innerHTMLPlugin = definePlugin<Element>(() => ({
  keys: ['innerHTML'],
  setup() {
    let current: null | string = null

    return {
      commit(input, node) {
        let next = normalizeHTML(input.props.innerHTML)
        delete input.props.innerHTML
        if (current === next) return
        node.innerHTML = next ?? ''
        current = next
      },
      remove(node, reason) {
        if (reason === 'unmount') return
        if (current == null) return
        node.innerHTML = ''
        current = null
      },
    }
  },
}))

function normalizeHTML(value: unknown): null | string {
  if (value == null) return null
  return String(value)
}
