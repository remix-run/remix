import {
  createRecommendedReconciler,
  draggable,
  on,
  type Handle,
} from '../../src/plugin-spike/index.ts'

function App(handle: Handle) {
  let count = 0

  return () => (
    <div>
      <h1>Count: {count}</h1>
      <button
        use={[
          draggable(),
          on('click', () => {
            count++
            handle.update()
          }),
        ]}
      >
        Increment {count}
      </button>
    </div>
  )
}

let reconciler = createRecommendedReconciler()
let root = reconciler.createRoot(document.body)
root.render(<App />)
