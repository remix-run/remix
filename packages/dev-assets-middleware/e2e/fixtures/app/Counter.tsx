import type { Handle } from '@remix-run/component'
import { formatCount } from './utils.js'

/**
 * A simple counter component for E2E HMR testing.
 */
export function Counter(handle: Handle) {
  let count = 0

  return () => (
    <div data-testid="counter">
      <p data-testid="count">{formatCount(count)}</p>
      <button
        data-testid="increment"
        on={{
          click: () => {
            count++
            handle.update()
          },
        }}
      >
        Increment
      </button>
    </div>
  )
}
