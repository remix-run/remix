import { createRoot, type Handle } from 'remix/component'

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

createRoot(document.body).render(<App />)
