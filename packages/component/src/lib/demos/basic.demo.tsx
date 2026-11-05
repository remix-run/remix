import { on, type Handle } from '@remix-run/component'

/**
 * @name Basic Counter
 * @description The smallest interactive component counter from the standalone demos.
 */
export default function App(handle: Handle) {
  let count = 0
  return () => (
    <button
      mix={[
        on('click', () => {
          count++
          handle.update()
        }),
      ]}
    >
      Ye ol' counter: {count}
    </button>
  )
}
