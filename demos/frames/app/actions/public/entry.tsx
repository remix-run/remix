import { run } from 'remix/ui'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    let exp = (mod as any)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }
    return exp
  },
})

app.ready().catch((error: unknown) => console.error(error))
