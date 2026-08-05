import { run } from 'remix/ui'

run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
  async resolveFrame(src, options) {
    let headers = new Headers({ Accept: 'text/html' })
    if (options?.target) headers.set('X-Remix-Target', options.target)

    let response = await fetch(src, {
      credentials: 'same-origin',
      headers,
      method: options?.method,
      body: options?.method?.toLowerCase() === 'get' ? undefined : options?.formData,
      signal: options?.signal,
    })
    return response.body ?? response.text()
  },
})
