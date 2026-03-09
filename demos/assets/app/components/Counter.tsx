import type { Handle } from '@remix-run/component'
import { on } from '@remix-run/component'

export function Counter(handle: Handle) {
  let count = 0

  return () => (
    <div>
      <p>Count: {count}</p>
      <button
        mix={[
          on('click', () => {
            count++
            handle.update()
          }),
        ]}
      >
        Increment
      </button>
    </div>
  )
}
