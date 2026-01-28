import type { Handle } from '@remix-run/component'
import { formatCount } from './utils.ts'

/**
 * A simple counter component for E2E HMR testing.
 *
 * @param handle The component handle for triggering updates
 * @returns A render function that returns the counter UI
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
