import { run } from 'remix/component'

// Every page is a complete static document with one import map, and the site uses no Frames or
// client navigation that would add import maps later, so native `import()` needs no
// multiple-import-maps polyfill.
const app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    let module = await import(moduleUrl)
    let Component = module[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
})

app.addEventListener('error', (event) => {
  console.error('Component error:', event.error)
})
