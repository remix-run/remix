import { createRoot, SPA } from 'remix/ui'

import { router } from './router.tsx'
import { Fallback } from './ui/layout.tsx'

const root = createRoot(document.getElementById('app')!)

root.addEventListener('error', (event) => {
  console.error('Remix UI root failed:', event.error)
})

root.render(<SPA router={router} fallback={<Fallback />} />)
