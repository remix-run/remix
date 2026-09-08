import { run } from 'remix/ui'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
})

if (import.meta.hot) {
  import.meta.hot.on('server:update', async () => {
    try {
      await app.ready()
      await app.frames.top.reload()
    } catch (error) {
      console.error('Error reloading top frame on server update', error)
    }
  })
}
