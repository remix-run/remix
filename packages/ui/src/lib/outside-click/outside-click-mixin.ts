import { createMixin } from '@remix-run/component'

let onOutsideClick = createMixin<HTMLElement, [active: boolean, handler: () => void]>((handle) => {
  let active = false
  let handler: () => void = () => {}

  handle.addEventListener('insert', (event) => {
    let node = event.node
    let doc = node.ownerDocument

    doc.addEventListener(
      'click',
      (event) => {
        if (!active || (event.target instanceof Node && node.contains(event.target))) {
          return
        }
        event.stopPropagation()
        handler()
      },
      { capture: true, signal: handle.signal },
    )
  })

  return (nextActive, nextHandler) => {
    active = nextActive
    handler = nextHandler
  }
})

export { onOutsideClick }
