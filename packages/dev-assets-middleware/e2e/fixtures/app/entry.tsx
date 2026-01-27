import { createRoot, requestRemount } from '@remix-run/component'
import type { Handle } from '@remix-run/component'

// Wire up requestRemount for HMR (global avoids bundler issues)
;(window as any).__hmr_request_remount_impl = requestRemount

async function main() {
  let { Counter } = await import('/assets/Counter.js')
  let { Header, Footer } = await import('/assets/components.js')

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
}

main().catch(console.error)
