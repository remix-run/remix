import type { Handle } from 'remix/component'

export function InterruptibleKeyframes(handle: Handle) {
  let box: HTMLDivElement
  let currentAnimation: Animation | null = null

  function getCurrentScale(): number {
    let matrix = new DOMMatrix(getComputedStyle(box).transform)
    return matrix.a
  }

  function interruptAnimation() {
    if (currentAnimation) {
      currentAnimation.commitStyles()
      currentAnimation.cancel()
      currentAnimation = null
    }
  }

  return () => (
    <div
      connect={(node) => (box = node)}
      css={{
        width: 100,
        height: 100,
        backgroundColor: '#0cdcf7',
        borderRadius: 5,
      }}
      on={{
        pointerenter() {
          interruptAnimation()
          let startScale = getCurrentScale()

          currentAnimation = box.animate(
            [
              { transform: `scale(${startScale})`, offset: 0, easing: 'ease-in-out' },
              { transform: 'scale(1.1)', offset: 0.6, easing: 'ease-out' },
              { transform: 'scale(1.6)', offset: 1 },
            ],
            {
              duration: 500,
              fill: 'forwards',
            },
          )
        },
        pointerleave() {
          interruptAnimation()
          let startScale = getCurrentScale()

          currentAnimation = box.animate(
            [{ transform: `scale(${startScale})` }, { transform: 'scale(1)' }],
            {
              duration: 300,
              easing: 'ease-out',
              fill: 'forwards',
            },
          )
        },
      }}
    />
  )
}
