import { createRoot } from '@remix-run/component'
import { App } from './components/App.tsx'
import { routes } from './routes.ts'

let root = createRoot(document.getElementById('app')!)
root.render(<App name="World" />)

// Spawn a web worker for CPU-bound work off the main thread.
let workerUrl = routes.scripts.href({ path: 'app/worker.ts' })
let resultEl = document.getElementById('worker-result')
if (resultEl) {
  let worker = new Worker(workerUrl, { type: 'module' })
  worker.addEventListener('message', (event: MessageEvent<number>) => {
    resultEl!.textContent = `fib(42) = ${event.data}`
    worker.terminate()
  })
  worker.postMessage(42)
}
