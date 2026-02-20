import { createRoot } from '@remix-run/component'
import * as workerAsset from '#assets/app/worker.ts'

import { App } from './components/App.tsx'

let root = createRoot(document.getElementById('app')!)
root.render(<App name="World" />)

// Demonstrate cross-script #assets/ import via a Web Worker.
// Workers must be loaded by URL — there is no static import equivalent.
// In dev, workerAsset.href is '/__@assets/app/worker.ts', served on-demand.
// In a bundled production build, substituteAssetPlaceholders must rewrite that
// placeholder string to the real hashed URL before anything is written to disk.
let resultEl = document.getElementById('worker-result')
if (resultEl) {
  let worker = new Worker(workerAsset.href, { type: 'module' })
  worker.addEventListener('message', (event: MessageEvent<number>) => {
    resultEl!.textContent = `fib(42) = ${event.data}`
    worker.terminate()
  })
  worker.postMessage(42)
}
