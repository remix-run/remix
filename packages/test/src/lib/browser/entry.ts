import { run } from '@remix-run/component'
import * as components from './status.tsx'

let app = run(document, {
  async loadModule(moduleUrl: string, exportName: string) {
    let Component = components[exportName as keyof typeof components]
    if (!Component) {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
})

app.ready().catch((error: unknown) => {
  console.error('Hydration failed:', error)
})
