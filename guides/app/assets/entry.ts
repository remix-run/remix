import type { FrameContent } from 'remix/ui'
import { run } from 'remix/ui'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
  async resolveFrame(src, signal): Promise<FrameContent> {
    let response = await fetch(src, { headers: { Accept: 'text/html' }, signal })

    if (!response.ok) {
      return `<pre>Navigation error: ${response.status} ${response.statusText}</pre>`
    }

    return response.body ?? response.text()
  },
})

app.ready().catch((error: unknown) => {
  console.error('Remix UI failed to start:', error)
})
