import { createFrame } from '@remix-run/dom'

let frame = createFrame(document, {
  async loadModule(moduleUrl, name) {
    let mod = await import(moduleUrl)
    if (!mod) {
      throw new Error(`Unknown module: ${moduleUrl}#${name}`)
    }
    let Component = mod[name]
    if (!Component) {
      throw new Error(`Unknown component: ${moduleUrl}#${name}`)
    }
    return Component
  },
  async resolveFrame(frameUrl) {
    let res = await fetch(frameUrl)
    if (res.ok) {
      return res.text()
    }
    throw new Error(`Failed to fetch ${frameUrl}`)
  },
})

await frame.ready()

console.log('READY')
