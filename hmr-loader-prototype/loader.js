// loader.js - Node loader hook for HMR transforms
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { watch } from 'chokidar'

// Simple module graph - tracks what we've seen
const moduleGraph = new Map()

// Track boundaries (files that have HMR handlers)
const hmrBoundaries = new Set()

// Track if we've injected IPC setup into entry point
let ipcSetupInjected = false

export async function load(url, context, nextLoad) {
  // Skip node_modules and built-ins
  if (url.includes('node_modules') || url.startsWith('node:')) {
    return nextLoad(url, context)
  }

  // Get the file path
  let filePath
  try {
    filePath = fileURLToPath(url)
  } catch {
    return nextLoad(url, context)
  }

  // Track in module graph
  if (!moduleGraph.has(url)) {
    moduleGraph.set(url, { url, file: filePath })
  }

  // Read source
  let source
  try {
    source = await readFile(filePath, 'utf-8')
  } catch {
    return nextLoad(url, context)
  }

  // Inject IPC setup into entry point (server.js)
  if (!ipcSetupInjected && filePath.endsWith('server.js')) {
    console.log('[LOADER] Injecting HMR IPC setup into entry point')
    ipcSetupInjected = true

    let transformed = `import { setupHMRIPC } from './hmr-runtime.js'
setupHMRIPC()

${source}`

    return {
      format: 'module',
      source: transformed,
      shortCircuit: true,
    }
  }

  // Check if this file exports handlers (simple heuristic: has "export default")
  let hasHandlers = source.includes('export default') && source.includes('GET:')

  if (hasHandlers) {
    console.log(`[LOADER] Transforming ${filePath} with HMR`)
    hmrBoundaries.add(url)

    // Simple transform: wrap the entire export default
    // Extract everything between the braces
    let exportMatch = source.match(/export default (\{[\s\S]*\})/)

    if (exportMatch) {
      let handlersObject = exportMatch[1]

      let transformed = `import { __hmr_register_handler, __hmr_wrap_handler } from './hmr-runtime.js'

// Strip query string from import.meta.url for consistent registration
let moduleUrl = import.meta.url.split('?')[0]

// Original handlers
let handlers = ${handlersObject}

// Register and wrap each handler
let wrappedHandlers = {}
for (let [method, impl] of Object.entries(handlers)) {
  __hmr_register_handler(moduleUrl, method, impl)
  wrappedHandlers[method] = __hmr_wrap_handler(moduleUrl, method, impl)
}

export default wrappedHandlers
`

      return {
        format: 'module',
        source: transformed,
        shortCircuit: true,
      }
    }
  }

  // No transformation needed
  return nextLoad(url, context)
}
