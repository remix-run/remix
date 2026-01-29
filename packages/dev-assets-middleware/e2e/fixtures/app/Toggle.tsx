import type { Handle } from '@remix-run/component'
import { ConditionalChild } from './ConditionalChild.tsx'

export function Toggle(handle: Handle) {
  let showChild = true

  return () => (
    <div data-testid="toggle-container">
      <button
        data-testid="toggle-button"
        on={{
          click() {
            showChild = !showChild
            handle.update()
          },
        }}
      >
        {showChild ? 'Hide Child' : 'Show Child'}
      </button>
      {showChild && <ConditionalChild />}
    </div>
  )
}
