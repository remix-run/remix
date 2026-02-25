import { on, render } from '@remix-run/dom/spa'
import type { ComponentHandle } from '@remix-run/dom/spa'

function Counter(handle: ComponentHandle, _setup: unknown) {
  let count = 0
  return () => (
    <button
      mix={[
        on('click', (event) => {
          count++
          void handle.update()
        }),
      ]}
      style={{ fontSize: '24px', padding: '12px 16px' }}
    >
      Count: {count}
    </button>
  )
}

let root = render(<Counter />, document.body)
