import { run } from 'remix/component'

let app = run(document, {
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = await import(moduleUrl)
    let Component = (mod as any)[exportName]
    if (!Component) {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
})

app.ready().catch((error: unknown) => {
  console.error('Hydration failed:', error)
})
