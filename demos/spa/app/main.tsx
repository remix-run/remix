import { run } from 'remix/spa'

import { router } from './router.ts'
import { LoadingIndicator } from './ui/app-shell.tsx'

// `run()` from `remix/spa` is a wrapper around `remix/ui`'s `run()` that implements
// a SPA-aware `resolveFrame` and handles the fallback rendering and initial top-frame
// reload to render the initial UI
const app = run(router, { fallback: <LoadingIndicator /> })
app.addEventListener('error', (event) => {
  console.error('Remix SPA failed:', event.error)
})
await app.ready()
