import { createRoot, requestRemount } from '@remix-run/component'
import type { Handle } from '@remix-run/component'
import { Counter } from './Counter.tsx'
import { Header, Footer } from './components.tsx'

// Wire up requestRemount for HMR
;(window as any).__hmr_request_remount_impl = requestRemount

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
