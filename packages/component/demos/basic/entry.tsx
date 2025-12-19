import { createRoot, type Handle } from '@remix-run/component'

function App(this: Handle) {
  let count = 0
  return () => (
    <button
      on={{
        click: () => {
          count++
          this.update()
        },
      }}
    >
      Ye ol' counter: {count}
    </button>
  )
}

createRoot(document.body).render(<App />)
