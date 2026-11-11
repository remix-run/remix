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
>(
  (handle) => {
    let active = false
    let handler: (target: Node | null) => void = () => {}
    let isInsideTarget: InsideTargetMatcher = () => false
    let stopPropagation = true

    handle.addEventListener('insert', (event) => {
      let node = event.node
      let doc = node.ownerDocument

      // A click is dispatched on the common ancestor of where the press started and ended, so a
      // press that began inside (a drag that left the surface), or before this layer was active
      // (a trigger that opened it on press), would otherwise count as outside.
      let ignoreClick = false

      doc.addEventListener(
        'pointerdown',
        (event) => {
          let target = event.target instanceof Node ? event.target : null
          ignoreClick = !active || (!!target && (node.contains(target) || isInsideTarget(target)))
        },
        { capture: true, signal: handle.signal },
      )

      function endPress() {
        // The click, when there is one, is dispatched in the same task as the pointerup.
        setTimeout(() => {
          ignoreClick = false
        })
      }

      doc.addEventListener('pointerup', endPress, { capture: true, signal: handle.signal })
      doc.addEventListener('pointercancel', endPress, { capture: true, signal: handle.signal })

      doc.addEventListener(
        'click',
        (event) => {
          let target = event.target instanceof Node ? event.target : null

          if (
            !active ||
            ignoreClick ||
            (target && (node.contains(target) || isInsideTarget(target)))
          ) {
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
  },
  { ssr: false },
)

export { onOutsideClick }
