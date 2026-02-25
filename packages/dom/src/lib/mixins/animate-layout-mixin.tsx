import { createMixin } from '@remix-run/reconciler'
import type { DomElementType } from '../jsx/jsx-runtime.ts'

export type AnimateLayoutOptions = {
  duration?: number
  easing?: string
}

export let animateLayout = createMixin<[options?: AnimateLayoutOptions], HTMLElement, DomElementType>(
  (handle) => {
  let activeNode: null | HTMLElement = null
  let previousRect: null | DOMRect = null
  let beforeCommitRect: null | DOMRect = null
  let activeAnimation: null | Animation = null

  let onBeforeCommit = () => {
    if (!activeNode) return
    beforeCommitRect = activeNode.getBoundingClientRect()
  }

  handle.root.addEventListener('beforeCommit', onBeforeCommit)

  handle.addEventListener('remove', () => {
    activeAnimation?.cancel()
    activeAnimation = null
    activeNode = null
    previousRect = null
    beforeCommitRect = null
    handle.root.removeEventListener('beforeCommit', onBeforeCommit)
  })

  return (options, props) => {
    let duration = options?.duration ?? 300
    let easing = options?.easing ?? 'ease'

    handle.queueTask((node, signal) => {
      if (signal.aborted) return
      if (!(node instanceof HTMLElement)) return

      activeNode = node

      let lastRect = node.getBoundingClientRect()
      let firstRect = beforeCommitRect ?? previousRect
      beforeCommitRect = null
      if (!firstRect) {
        previousRect = lastRect
        return
      }

      let deltaX = firstRect.left - lastRect.left
      let deltaY = firstRect.top - lastRect.top
      let canScale =
        firstRect.width > 0 && firstRect.height > 0 && lastRect.width > 0 && lastRect.height > 0
      let scaleX = canScale ? firstRect.width / lastRect.width : 1
      let scaleY = canScale ? firstRect.height / lastRect.height : 1
      let hasDelta =
        deltaX !== 0 ||
        deltaY !== 0 ||
        (canScale && (Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001))
      if (!hasDelta) {
        previousRect = lastRect
        return
      }

      let fromTransform = canScale
        ? `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`
        : `translate(${deltaX}px, ${deltaY}px)`

      if (activeAnimation) {
        activeAnimation.cancel()
        activeAnimation = null
      }

      let animation = node.animate(
        [
          { transform: fromTransform, transformOrigin: 'top left' },
          { transform: 'none', transformOrigin: 'top left' },
        ],
        { duration, easing },
      )
      activeAnimation = animation

      let clearIfActive = () => {
        if (activeAnimation !== animation) return
        activeAnimation = null
      }

      animation.addEventListener('finish', clearIfActive)
      animation.addEventListener('cancel', clearIfActive)
      previousRect = lastRect
    })

    return <handle.element {...props} />
  }
  },
)
