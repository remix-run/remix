import { createHydrationRoot } from 'remix/component'

let root = createHydrationRoot({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    let Component = mod[exportName]
    if (!Component) {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
})

root.addEventListener('error', (event) => {
  console.error('Hydration error:', event.error)
})
