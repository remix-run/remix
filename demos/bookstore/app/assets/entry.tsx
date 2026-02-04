import { createFrame } from 'remix/component'

let frame = createFrame(document, {
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = await import(moduleUrl)
    let Component = (mod as any)[exportName]
    if (!Component) {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },

  async resolveFrame(src: string) {
    let response = await fetch(src, { headers: { accept: 'text/html' } })
    return await response.text()
  },
})

frame.ready().catch((error: unknown) => {
  console.error('Frame adoption failed:', error)
})
