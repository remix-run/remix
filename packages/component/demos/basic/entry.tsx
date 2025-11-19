import { createRoot } from '@remix-run/component'

function App(this: Remix.Handle) {
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
