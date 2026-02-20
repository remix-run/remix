import { createDomReconciler, on } from '@remix-run/dom'

function Counter(handle: { update(): Promise<AbortSignal> }, _setup: unknown) {
  let count = 0
  return () => (
    <button
      mix={[
        on('click', () => {
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

let reconciler = createDomReconciler(document)
let root = reconciler.createRoot(document.body)
root.render(<Counter />)
