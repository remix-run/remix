import { run } from 'remix/ui'
import type { AppRuntime } from 'remix/ui'

let app = start()

export function start(): AppRuntime {
  return run({
    async loadModule(moduleUrl: string, exportName: string) {
      let mod = (await import(moduleUrl)) as Record<string, unknown>
      let Component = mod[exportName]
      if (typeof Component !== 'function') {
        throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
      }
      return Component
    },
    async resolveFrame(src, signal) {
      let response = await fetch(src, { headers: { Accept: 'text/html' }, signal })
      if (!response.ok) {
        return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
      }
      if (response.body) return response.body
      return response.text()
    },
  })
}

if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (typeof module.start !== 'function') {
      import.meta.hot?.invalidate('Updated bookstore entry module did not export start()')
      return
    }
    app.dispose()
    app = module.start()
  })

  import.meta.hot.dispose(() => {
    app.dispose()
  })

  import.meta.hot.on('server:update', async () => {
    try {
      await app.ready()
      await app.frames.top.reload()
    } catch (error) {
      console.error('Error reloading top frame on server update', error)
    }
  })
}

app.ready().catch((error: unknown) => {
  console.error('Frame adoption failed:', error)
})
