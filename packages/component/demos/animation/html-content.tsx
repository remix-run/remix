import type { Handle } from 'remix/component'
import { spring } from 'remix/component'

export function HTMLContent(handle: Handle) {
  let count = 0
  let from = 0
  let to = 100

  let counter = spring({ duration: 3000, bounce: 0 })

  function animate() {
    if (handle.signal.aborted) return

    let { value: t, done } = counter.next()
    if (done) return

    count = Math.round(from + (to - from) * t)
    handle.update()
    requestAnimationFrame(animate)
  }

  handle.queueTask(() => {
    requestAnimationFrame(animate)
  })

  return () => (
    <pre
      css={{
        fontSize: '64px',
        margin: 0,
        color: '#8df0cc',
      }}
    >
      {count}
    </pre>
  )
}
