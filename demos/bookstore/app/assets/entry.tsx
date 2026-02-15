import { run } from 'remix/component'

let app = run(document, {
  async loadModule({ src }, exportName, chunks) {
    let modPromise = import(src)
    chunks.map(({ src }) => import(src).catch())
    let mod = await modPromise
    let Component = (mod as any)[exportName]
    if (!Component) {
      throw new Error(`Unknown component: ${src}#${exportName}`)
    }
    return Component
  },
  async resolveFrame(src, signal) {
    let response = await fetch(src, { headers: { accept: 'text/html' }, signal })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }
    // let text = await response.text()
    // console.log(text)
    // return text
    if (response.body) return response.body
    return response.text()
  },
})

app.ready().catch((error: unknown) => {
  console.error('Frame adoption failed:', error)
})
