import { createRoot } from '@remix-run/component'
import type { Handle } from '@remix-run/component'
import { Toggle } from './Toggle.tsx'

function App(handle: Handle) {
  return () => (
    <div data-testid="app">
      <h1>Conditional Rendering Test</h1>
      <Toggle />
    </div>
  )
}

let container = document.getElementById('app')!
container.innerHTML = ''
let root = createRoot(container)
root.render(<App />)
