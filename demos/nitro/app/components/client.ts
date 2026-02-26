import { run } from 'remix/component'

let app = run(document, {
  async loadModule({ src }, exportName, chunks) {
    let modPromise = import(/* @vite-ignore */ src)
    chunks.map(({ src }) => import(/* @vite-ignore */ src).catch())
    let mod = await modPromise

    let exp = (mod as any)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${src}" is not a function`)
    }
    return exp
  },
  async resolveFrame(src, signal) {
    let res = await fetch(src, { headers: { accept: 'text/html' }, signal })
    if (!res.ok) {
      return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
    }
    if (res.body) return res.body
    return await res.text()
  },
})

app.ready().catch((error: unknown) => console.error(error))
