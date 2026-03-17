import { run } from 'remix/component'

let app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = await import(moduleUrl)
    let Component = (mod as any)[exportName]
    if (!Component) {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async resolveFrame(src, signal) {
    let response = await fetch(src, { headers: { accept: 'text/html' }, signal })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }
    if (response.body) return response.body
    return response.text()
  },
})

app.ready().catch((error: unknown) => {
  console.error('Frame adoption failed:', error)
})

window.navigation.addEventListener('navigate', () => {
  let toggle = document.getElementById('nav-toggle') as HTMLInputElement | null
  if (toggle) {
    toggle.checked = false
  }

  let transition = window.navigation.transition
  if (transition) {
    let overlay = document.getElementById('nav-overlay')
    overlay?.classList.add('active')
    transition.finished.finally(() => overlay?.classList.remove('active'))
  }
})
