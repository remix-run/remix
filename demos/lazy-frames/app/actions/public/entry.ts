import { run } from 'remix/ui'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let moduleExports: unknown = await import(moduleUrl)
    if (moduleExports === null || typeof moduleExports !== 'object') {
      throw new Error(`Module "${moduleUrl}" has no named exports`)
    }

    let component = Reflect.get(moduleExports, exportName)
    if (typeof component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }

    return component
  },
})

app.ready().catch((error: unknown) => {
  console.error('Lazy Frame adoption failed:', error)
})
