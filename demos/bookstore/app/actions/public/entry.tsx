import { run } from 'remix/ui'

const app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = (await import(moduleUrl)) as Record<string, unknown>
    let Component = mod[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async resolveFrame(src, options) {
    let response = await fetch(src, {
      headers: { Accept: 'text/html' },
      method: options?.method,
      body: getRequestBody(options?.formData, options?.method, options?.encType),
      signal: options?.signal,
    })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }
    if (response.body) return response.body
    return response.text()
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

function getRequestBody(
  formData?: FormData,
  method?: string,
  encType?: string,
): BodyInit | undefined {
  if (!formData || method?.toLowerCase() === 'get') return
  if (encType !== 'application/x-www-form-urlencoded') return formData

  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(name, typeof value === 'string' ? value : value.name)
  }
  return body
}

app.ready().catch((error: unknown) => {
  console.error('Frame adoption failed:', error)
})
