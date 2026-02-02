import { createRoot } from '@remix-run/component'

import { App } from './components/App.tsx'

let root = createRoot(document.getElementById('app')!)

root.render(<App name="World" />)
