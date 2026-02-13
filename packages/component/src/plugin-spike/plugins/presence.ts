import { definePlugin } from '../types.ts'

let activeAnimations = new WeakMap<Element, Animation>()

export const presence = definePlugin(() => (hostHandle) => {
  let presenceMs = 0
  let animation: null | Animation = null
  let exiting = false
  let committed = false

  hostHandle.addEventListener('afterFlush', (event) => {
    if (presenceMs <= 0) return
    if (!exiting && committed) return
    startEnterAnimation(event.node)
    committed = true
  })

  hostHandle.addEventListener('remove', (event) => {
    if (presenceMs <= 0) return
    exiting = true
    let exitAnimation = startExitAnimation(event.node)
    event.waitUntil(
      exitAnimation.finished.then(() => {
        if (activeAnimations.get(event.node) === exitAnimation) {
          activeAnimations.delete(event.node)
        }
      }),
    )
  })

  return (input) => {
    presenceMs = toPresenceMs(input.props.presenceMs)
    if (!('presenceMs' in input.props)) return input
    let { presenceMs: _presenceMs, ...props } = input.props
    return { ...input, props }
  }

  function startEnterAnimation(node: Element) {
    activeAnimations.get(node)?.cancel()
    animation = node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: presenceMs,
      easing: 'ease-out',
      fill: 'both',
    })
    activeAnimations.set(node, animation)
    void animation.finished.catch(() => undefined)
    exiting = false
  }

  function startExitAnimation(node: Element) {
    activeAnimations.get(node)?.cancel()
    animation = node.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: presenceMs,
      easing: 'ease-in',
      fill: 'both',
    })
    activeAnimations.set(node, animation)
    void animation.finished.catch(() => undefined)
    return animation
  }
})

function toPresenceMs(value: unknown) {
  if (typeof value !== 'number') return 0
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  return value
}
