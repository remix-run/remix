import { run } from 'remix/ui'

run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
  async resolveFrame(src, signal, target) {
    let headers = new Headers({ Accept: 'text/html' })
    if (target) headers.set('X-Remix-Target', target)

    let response = await fetch(src, {
      credentials: 'same-origin',
      headers,
      signal,
    })
    return response.body ?? response.text()
  },
})
