import { run } from 'remix/ui'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl)
    return module[exportName]
  },
})

app.ready().catch((error: unknown) => console.error(error))
