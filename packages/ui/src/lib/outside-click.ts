import { createMixin } from '@remix-run/component'

type InsideTargetMatcher = (target: Node) => boolean

const onOutsideClick = createMixin<
  HTMLElement,
  [
    active: boolean,
    handler: (target: Node | null) => void,
    isInsideTarget?: InsideTargetMatcher,
    stopPropagation?: boolean,
  ]
>((handle) => {
  let active = false
  let handler: (target: Node | null) => void = () => {}
  let isInsideTarget: InsideTargetMatcher = () => false
  let stopPropagation = true

  handle.addEventListener('insert', (event) => {
    let node = event.node
    let doc = node.ownerDocument

    doc.addEventListener(
      'click',
      (event) => {
        let target = event.target instanceof Node ? event.target : null

        if (!active || (target && (node.contains(target) || isInsideTarget(target)))) {
          return
        }

        if (stopPropagation) {
          event.stopPropagation()
        }

        handler(target)
      },
      { capture: true, signal: handle.signal },
    )
  })

  return (
    nextActive,
    nextHandler,
    nextIsInsideTarget = () => false,
    nextStopPropagation = true,
  ) => {
    active = nextActive
    handler = nextHandler
    isInsideTarget = nextIsInsideTarget
    stopPropagation = nextStopPropagation
  }
})

export { onOutsideClick }
