import { run } from 'remix/ui'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let module: Record<string, unknown> = await import(moduleUrl)
    let component = module[exportName]

    if (typeof component !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }

    return component
  },
})

app.ready().catch((error: unknown) => console.error(error))
