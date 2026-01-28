import { createRoot } from '@remix-run/component'
import type { Handle } from '@remix-run/component'
import { Counter } from './Counter.tsx'
import { Header, Footer } from './components.tsx'

function App(handle: Handle) {
  return () => (
    <div data-testid="app">
      <Header />
      <Counter />
      <Footer />
    </div>
  )
}

let container = document.getElementById('app')!
container.innerHTML = ''
let root = createRoot(container)
root.render(<App />)
