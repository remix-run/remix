// hmr-runtime.js - Runtime for managing handler implementations (similar to client HMR runtime)

// Registry of handler implementations
// url -> method -> implementation
const handlers = new Map()

export function __hmr_register_handler(url, method, impl) {
  if (!handlers.has(url)) {
    handlers.set(url, new Map())
  }
  handlers.get(url).set(method, impl)
  console.log(`[HMR] Registered handler: ${url} ${method}`)
}

export function __hmr_get_handler(url, method) {
  let handler = handlers.get(url)?.get(method)
  console.log(`[HMR] Getting handler for ${url} ${method}:`, handler ? 'FOUND' : 'NOT FOUND')
  console.log(`[HMR] Available URLs in registry:`, Array.from(handlers.keys()))
  return handler
}

export function __hmr_wrap_handler(url, method, fallbackImpl) {
  // Return a wrapper that delegates to the current implementation
  return function wrappedHandler(...args) {
    let impl = __hmr_get_handler(url, method)
    if (!impl) {
      console.warn(`[HMR] Handler not found, using fallback: ${url} ${method}`)
      return fallbackImpl(...args)
    }
    return impl(...args)
  }
}

// Triggered by supervisor via IPC
export async function __hmr_update(url, timestamp) {
  console.log(`[HMR] Updating ${url}?t=${timestamp}`)
  try {
    // Dynamic import with cache-busting query string
    let newModule = await import(`${url}?t=${timestamp}`)

    // The new module registers itself, but under the cache-busted URL
    // We need to copy those registrations to the original URL
    // This is handled by the loader's transform which will call __hmr_register_handler
    // But we need to tell it to use the ORIGINAL url, not the cache-busted one

    console.log(`[HMR] Successfully updated ${url}`)
    return newModule
  } catch (error) {
    console.error(`[HMR] Failed to update ${url}:`, error)
    throw error
  }
}

// Setup IPC listener for supervisor messages
// This is automatically injected into server.js by the loader
export function setupHMRIPC() {
  if (process.send) {
    process.on('message', async (msg) => {
      if (msg.type === 'hmr') {
        console.log(`[HMR] Received update message from supervisor`)
        await __hmr_update(msg.file, msg.timestamp)
      }
    })
    console.log('[HMR] IPC listener registered\n')
  } else {
    console.log('[HMR] Warning: No IPC channel available')
  }
}
