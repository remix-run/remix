// =============================================================================
// HMR Runtime Module (served by @remix-run/dev-assets-middleware)
// =============================================================================

import { requestRemount, type Handle } from '@remix-run/component'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Component state stored per handle
// Uses null-prototype object to prevent prototype pollution (e.g., __proto__, constructor)
interface ComponentState {
  [key: string]: unknown
}

// Component function: (handle) => renderFn
type ComponentFunction = (handle: Handle) => RenderFunction

// Render function: (...args) => RemixNode
// Uses rest parameters to allow flexible argument passing
type RenderFunction = (...args: unknown[]) => unknown

// Component registry entry
interface ComponentEntry {
  impl: ComponentFunction | null
  handles: Set<Handle>
}

// Handle metadata for fast lookup
interface HandleMetadata {
  url: string
  name: string
  renderFn: RenderFunction
}

type HmrMessage =
  | {
      type: 'connected'
    }
  | {
      type: 'update'
      files: string[]
      timestamp: number
    }
  | {
      type: 'reload'
    }

// Extend window interface for HMR connection status
declare global {
  interface Window {
    __hmr_connected: boolean
  }
}

// ---------------------------------------------------------------------------
// Component State Storage
// ---------------------------------------------------------------------------
// Component state persists across HMR updates, allowing the new component
// function to access old state values (preserving counters, form inputs, etc.)
// Uses null-prototype objects to prevent prototype pollution

let componentState = new WeakMap<Handle, ComponentState>()

// Separate storage for HMR infrastructure (setup hash tracking)
let setupHashes = new WeakMap<Handle, string>()

export function __hmr_state(handle: Handle): ComponentState {
  if (!componentState.has(handle)) {
    // Use null-prototype object to prevent prototype pollution
    // Properties like __proto__, constructor, etc. become safe regular properties
    componentState.set(handle, Object.create(null))
  }
  return componentState.get(handle)!
}

export function __hmr_clear_state(handle: Handle): void {
  componentState.delete(handle)
  setupHashes.delete(handle)
}

// ---------------------------------------------------------------------------
// HMR Registry
// ---------------------------------------------------------------------------

// Nested map: semantic structure organized by URL, then component name
// url → Map<name, { impl: componentFn, handles: Set<handle> }>
let components = new Map<string, Map<string, ComponentEntry>>()

// Fast lookup from handle to its metadata
// handle → { url, name, renderFn }
let handleToComponent = new WeakMap<Handle, HandleMetadata>()

export function __hmr_register(
  moduleUrl: string,
  componentName: string,
  handle: Handle,
  renderFn: RenderFunction,
): void {
  // Store handle metadata for fast lookup
  handleToComponent.set(handle, { url: moduleUrl, name: componentName, renderFn: renderFn })

  // Ensure component entry exists in nested map
  if (!components.has(moduleUrl)) {
    components.set(moduleUrl, new Map())
  }
  let moduleComponents = components.get(moduleUrl)!
  if (!moduleComponents.has(componentName)) {
    moduleComponents.set(componentName, { impl: null, handles: new Set() })
  }

  // Add handle to the component's handle set
  moduleComponents.get(componentName)!.handles.add(handle)
}

export function __hmr_call(handle: Handle, ...args: unknown[]): unknown {
  let metadata = handleToComponent.get(handle)
  if (!metadata) {
    throw new Error('[HMR] No render function registered for handle')
  }
  return metadata.renderFn(...args)
}

// Register a component function in the registry
// Called by transforms: allows remount to use the current implementation
export function __hmr_register_component(
  moduleUrl: string,
  componentName: string,
  componentFn: ComponentFunction,
): void {
  // Ensure component entry exists
  if (!components.has(moduleUrl)) {
    components.set(moduleUrl, new Map())
  }
  let moduleComponents = components.get(moduleUrl)!
  if (!moduleComponents.has(componentName)) {
    moduleComponents.set(componentName, { impl: null, handles: new Set() })
  }

  // Store the implementation
  moduleComponents.get(componentName)!.impl = componentFn
}

// Get the current component function from the registry
// Called by the delegating wrapper that Remix holds
export function __hmr_get_component(
  moduleUrl: string,
  componentName: string,
): ComponentFunction | undefined {
  let moduleComponents = components.get(moduleUrl)
  if (!moduleComponents) return undefined

  let component = moduleComponents.get(componentName)
  return component ? (component.impl ?? undefined) : undefined
}

export function __hmr_update(
  moduleUrl: string,
  getNewModule: () => Promise<Record<string, ComponentFunction>>,
): Promise<void> {
  let moduleComponents = components.get(moduleUrl)
  if (!moduleComponents || moduleComponents.size === 0) {
    console.log('[HMR] No instances found for ' + moduleUrl)
    return Promise.resolve()
  }

  console.log('[HMR] Updating ' + moduleUrl + '...')

  return getNewModule().then(function (newModule) {
    // NOTE: The module load itself calls __hmr_register_component with the impl.
    // We do NOT call it here - that would overwrite the impl with the wrapper!

    moduleComponents.forEach(function (component, componentName) {
      let newComponentFn = newModule[componentName]
      if (!newComponentFn) {
        console.warn('[HMR] Component ' + componentName + ' not found in new module')
        return
      }

      console.log(
        '[HMR] Updating ' + componentName + ' (' + component.handles.size + ' instance(s))',
      )

      component.handles.forEach(function (handle) {
        try {
          // This calls the wrapper, which delegates to __hmr_get_component,
          // which returns the impl that was registered when the module loaded.
          newComponentFn(handle)
          handle.update()
        } catch (error) {
          console.error('[HMR] Error updating ' + componentName + ':', error)
        }
      })
    })

    console.log('[HMR] Update complete for ' + moduleUrl)
  })
}

// ---------------------------------------------------------------------------
// Setup Hash Tracking
// ---------------------------------------------------------------------------

/**
 * Check if setup should run based on hash comparison.
 * - First run: execute setup, store hash, return false (continue)
 * - Hash matches: skip setup, return false (continue)
 * - Hash changed: clear state, return true (signal remount needed)
 *
 * When this returns true, the caller should:
 * 1. Call requestRemount(handle)
 * 2. Return a noop render function
 *
 * @param handle The component handle
 * @param hash Hash of the setup scope code
 * @param setupFn Function to execute on first run
 * @returns True if remount is needed (setup changed), false otherwise
 */
export function __hmr_setup(handle: Handle, hash: string, setupFn: () => void): boolean {
  let currentHash = setupHashes.get(handle)
  if (currentHash === undefined) {
    // First run - execute setup and store hash
    setupFn()
    setupHashes.set(handle, hash)
    return false
  }
  if (currentHash !== hash) {
    // Hash changed - clear state and signal remount needed
    console.warn('[HMR] Setup scope changed, component will remount')
    __hmr_clear_state(handle)
    return true
  }
  // Hash matches - skip setup
  return false
}

// ---------------------------------------------------------------------------
// SSE Client for Automatic Updates
// ---------------------------------------------------------------------------

let eventSource: EventSource | null = null

export function __hmr_request_remount(handle: Handle): void {
  requestRemount(handle)
}

function parseHmrMessage(data: string): HmrMessage | null {
  try {
    let message = JSON.parse(data) as unknown

    // Validate that parsed data is an object with a type property
    if (
      typeof message !== 'object' ||
      message === null ||
      !('type' in message) ||
      typeof message.type !== 'string'
    ) {
      console.error('[HMR] Invalid message format: missing or invalid type field')
      return null
    }

    // Validate message type-specific fields
    switch (message.type) {
      case 'connected':
        return { type: 'connected' }

      case 'update': {
        if (
          !('files' in message) ||
          !Array.isArray(message.files) ||
          !message.files.every((f) => typeof f === 'string')
        ) {
          console.error('[HMR] Invalid update message: files must be string array')
          return null
        }

        if (!('timestamp' in message) || typeof message.timestamp !== 'number') {
          console.error('[HMR] Invalid update message: timestamp must be a number')
          return null
        }

        return {
          type: 'update',
          files: message.files,
          timestamp: message.timestamp,
        }
      }

      case 'reload':
        return { type: 'reload' }

      default:
        console.warn('[HMR] Unknown message type:', message.type)
        return null
    }
  } catch (error) {
    console.error('[HMR] Failed to parse message JSON:', error)
    return null
  }
}

function handleHmrMessage(message: HmrMessage): void {
  switch (message.type) {
    case 'connected':
      console.log('[HMR] Server connection established')
      break

    case 'update':
      console.log('[HMR] Received update for:', message.files)
      performUpdate(message.files, message.timestamp)
      break

    case 'reload':
      console.log('[HMR] Full reload requested')
      window.location.reload()
      break
  }
}

function performUpdate(files: string[], timestamp: number) {
  // Re-import each affected component with cache-busting timestamp
  let updates = files.map(function (file) {
    let importUrl = file + '?t=' + timestamp
    console.log('[HMR] Re-importing ' + importUrl)

    return __hmr_update(file, function () {
      return import(importUrl)
    })
  })

  Promise.all(updates)
    .then(function () {
      console.log('[HMR] All updates complete')
    })
    .catch(function (error) {
      console.error('[HMR] Update failed:', error)
      console.log('[HMR] Consider a full page reload')
    })
}

// ---------------------------------------------------------------------------
// Connection Status (for testing)
// ---------------------------------------------------------------------------

window.__hmr_connected = false

// ---------------------------------------------------------------------------
// Auto-connect (side effect)
// ---------------------------------------------------------------------------
// We connect automatically when this module is imported.
;(function connect() {
  let sseUrl = window.location.origin + '/__@remix/hmr-events'
  console.log('[HMR] Connecting to ' + sseUrl)

  eventSource = new EventSource(sseUrl)

  eventSource.onopen = function () {
    console.log('[HMR] Connected')
    window.__hmr_connected = true
  }

  eventSource.onmessage = function (event) {
    let message = parseHmrMessage(event.data)
    if (message) {
      handleHmrMessage(message)
    }
  }

  eventSource.onerror = function () {
    // EventSource automatically reconnects, just log it
    console.log('[HMR] Connection lost, reconnecting...')
    window.__hmr_connected = false
  }
})()

console.log('[HMR] Runtime loaded')
