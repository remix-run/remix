import { createFrame } from 'remix/component'

let frame = createFrame(document, {
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = await import(/* @vite-ignore */ moduleUrl)
    let exp = (mod as any)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }
    return exp
  },

  async resolveFrame(src: string) {
    let res = await fetch(src, { headers: { accept: 'text/html' } })
    return await res.text()
  },
})

frame.ready().catch((error: unknown) => console.error(error))
