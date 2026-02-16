import { definePlugin } from '@remix-run/reconciler'

export const innerHTMLPlugin = definePlugin<Element>(() => (host) => {
  let current: null | string = null

  return (input) => {
    if (!('innerHTML' in input.props) && current == null) return input

    let next = normalizeHTML(input.props.innerHTML)
    if ('innerHTML' in input.props) {
      delete input.props.innerHTML
    }

    host.queueTask((node) => {
      if (current === next) return
      node.innerHTML = next ?? ''
      current = next
    })

    return input
  }
})

function normalizeHTML(value: unknown): null | string {
  if (value == null) return null
  return String(value)
}
