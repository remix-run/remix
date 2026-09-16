import { run } from 'remix/ui'

run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl)
    let component = module[exportName]

    if (typeof component !== 'function') {
      throw new TypeError(`Unknown component: ${moduleUrl}#${exportName}`)
    }

    return component
  },
})
  .ready()
  .catch((error: unknown) => {
    console.error('Hydration failed:', error)
  })
