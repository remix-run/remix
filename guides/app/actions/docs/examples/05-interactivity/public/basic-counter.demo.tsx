import { on, type Handle } from 'remix/ui'

export function BasicCounter(handle: Handle) {
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
