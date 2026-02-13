import { createRecommendedReconciler, type Handle } from '../../src/plugin-spike/index.ts'

function App(handle: Handle) {
  let count = 0
  return () => (
    <button
      on={{
        click: () => {
          count++
          handle.update()
        },
      }}
    >
      Ye ol' counter: {count}
    </button>
  )
}

let reconciler = createRecommendedReconciler()
let root = reconciler.createRoot(document.body)
root.render(<App />)
