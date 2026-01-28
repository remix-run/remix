import { createRoot, requestRemount } from '@remix-run/component'

import { App } from './components/App.tsx'

// Wire up requestRemount for HMR
// TODO: This should be automatic once HMR runtime is a real TypeScript module
;(window as any).__hmr_request_remount_impl = requestRemount

let root = createRoot(document.getElementById('app')!)

root.render(<App name="World" />)
