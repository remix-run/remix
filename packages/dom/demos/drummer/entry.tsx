import { createDomReconciler } from '@remix-run/dom'
import { App } from './app.tsx'

document.body.style.margin = '0'

let reconciler = createDomReconciler(document)
let root = reconciler.createRoot(document.body)
root.render(<App />)
