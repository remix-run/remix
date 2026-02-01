// =============================================================================
// HMR Runtime Module (served by @remix-run/dev-assets-middleware)
// =============================================================================

import { type Handle } from '@remix-run/component'
import { setComponentStalenessCheck, requestReconciliation } from '@remix-run/component/dev'

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

// ---------------------------------------------------------------------------
// Refresh Infrastructure (Staleness Tracking)
// ---------------------------------------------------------------------------
// Staleness tracking for component remounting - integrated with reconciler
// Components are marked stale when setup scope changes, triggering full remount
// Track by stable key (moduleUrl:componentName) instead of function identity

let stalenessForCurrentUpdate = new Set<string>()

// Track handle → wrapper mapping for staleness checking
let handleToWrapper = new WeakMap<Handle, Function>()

// Map component functions to their stable keys for staleness checking
let componentToKey = new WeakMap<Function, string>()

// Register staleness checker with the component reconciler
setComponentStalenessCheck((componentFn) => {
  // Look up the stable key for this component function
  let key = componentToKey.get(componentFn)
  if (!key) return false
  return stalenessForCurrentUpdate.has(key)
})

// ---------------------------------------------------------------------------
// Component State Storage
// ---------------------------------------------------------------------------
// Component state persists across HMR updates, allowing the new component
// function to access old state values (preserving counters, form inputs, etc.)
// Uses null-prototype objects to prevent prototype pollution

let componentState = new WeakMap<Handle, ComponentState>()

// Store setup hash by moduleUrl:componentName (stable across HMR updates and remounts)
// Cannot use WeakMap because the key is a string
let setupHashes = new Map<string, string>()

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
  // Note: setup hash is keyed by wrapper function, not handle, so it persists across remounts
  // We don't delete it here - it's managed by __hmr_setup when hash changes
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
  wrapper?: Function,
): void {
  // Store wrapper function for staleness checking (if provided)
  if (wrapper) {
    handleToWrapper.set(handle, wrapper)
  }

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
  let componentEntry = moduleComponents.get(componentName)!
  componentEntry.handles.add(handle)

  // Listen for component unmount to clean up tracking
  handle.signal.addEventListener('abort', function () {
    // Check if this is a remount (new signal created) or actual removal
    // During remount: old signal aborted, new signal created, handle.signal.aborted = false
    // During removal: current signal aborted, no new signal, handle.signal.aborted = true
    if (!handle.signal.aborted) {
      // New signal exists - this is a remount, not a removal
      // Don't clean up HMR tracking, component is still mounted
      return
    }

    // Component was actually removed, clean up HMR tracking
    // Remove handle from the component's handle set
    componentEntry.handles.delete(handle)

    // Clean up state storage
    __hmr_clear_state(handle)

    // Clean up handle metadata
    handleToComponent.delete(handle)

    // Clean up empty entries to prevent memory leaks
    // BUT: Don't delete if component is marked as stale (being remounted)
    let stableKey = `${moduleUrl}:${componentName}`
    let isBeingRemounted = stalenessForCurrentUpdate.has(stableKey)

    if (componentEntry.handles.size === 0 && !isBeingRemounted) {
      moduleComponents.delete(componentName)
      if (moduleComponents.size === 0) {
        components.delete(moduleUrl)
      }
    }
  })
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

  // Register the component function → key mapping for staleness checking
  let stableKey = `${moduleUrl}:${componentName}`
  componentToKey.set(componentFn, stableKey)
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
    return Promise.resolve()
  }

  return getNewModule().then(function (newModule) {
    // NOTE: The module load itself calls __hmr_register_component with the impl.
    // We do NOT call it here - that would overwrite the impl with the wrapper!

    moduleComponents.forEach(function (component, componentName) {
      let newComponentFn = newModule[componentName]
      if (!newComponentFn) {
        console.warn('[HMR] Component ' + componentName + ' not found in new module')
        return
      }

      component.handles.forEach(function (handle) {
        try {
          // Call the wrapper with the existing handle to detect hash changes
          // This will mark components as stale if their setup scope changed
          newComponentFn(handle)
        } catch (error) {
          console.error('[HMR] Error updating ' + componentName + ':', error)
        }
      })
    })

    // After calling all components (which marks stale ones), trigger reconciliation
    // This will cause the reconciler to check staleness and remount stale components
    requestReconciliation()

    // Clear staleness after all updates are done and reconciliation has run
    // Use microtask to ensure this happens after the flush microtask
    queueMicrotask(() => {
      stalenessForCurrentUpdate.clear()
    })
  })
}

// ---------------------------------------------------------------------------
// Setup Hash Tracking
// ---------------------------------------------------------------------------

/**
 * Check if setup should run based on hash comparison.
 * - First run: execute setup, store hash, return false (continue)
 * - Hash matches: skip setup, return false (continue)
 * - Hash changed: mark stale and trigger remount, return true
 *
 * When this returns true, the caller should return a noop render function.
 * The remount will be triggered automatically via staleness + update mechanism.
 *
 * @param handle The component handle
 * @param state The component state object (__s)
 * @param moduleUrl The module URL (e.g., '/app/Counter.tsx')
 * @param componentName The component name (e.g., 'Counter')
 * @param hash Hash of the setup scope code
 * @param setupFn Function to execute on first run, accepts state as parameter
 * @param wrapper The wrapper function for this component
 * @returns True if remount is needed (setup changed), false otherwise
 */
export function __hmr_setup(
  handle: Handle,
  state: ComponentState,
  moduleUrl: string,
  componentName: string,
  hash: string,
  setupFn: (state: ComponentState) => void,
  wrapper: Function,
): boolean {
  // Store wrapper for future lookups (e.g., during remount)
  handleToWrapper.set(handle, wrapper)

  // Use moduleUrl:componentName as stable key across HMR updates
  let hashKey = `${moduleUrl}:${componentName}`

  // Register the wrapper function → key mapping for staleness checking
  // This is the function the reconciler sees (the delegating wrapper)
  componentToKey.set(wrapper, hashKey)
  let currentHash = setupHashes.get(hashKey)

  if (currentHash === undefined) {
    // First run - execute setup and store hash
    setupFn(state)
    setupHashes.set(hashKey, hash)
    return false
  }

  if (currentHash !== hash) {
    // Hash mismatch - need to determine if this is old handle or new handle after remount
    // Strategy: Check if state is empty
    // - Old handle: State exists (has values) → clear state, mark stale, trigger remount
    // - New handle: State empty (just created) → run setup with new hash, continue normally
    let stateIsEmpty = Object.keys(state).length === 0

    if (stateIsEmpty) {
      // State is empty = this is the NEW handle created after remount
      // Run setup with the new hash and update stored hash
      setupFn(state)
      setupHashes.set(hashKey, hash)
      return false
    } else {
      // State exists = this is the OLD handle detecting the hash change
      // Clear state, mark stale, and trigger remount (DON'T update hash yet)
      __hmr_clear_state(handle)

      // Mark component as stale for this update batch using stable key
      // Staleness will be cleared by __hmr_update after all updates complete
      stalenessForCurrentUpdate.add(hashKey)
      return true
    }
  }

  // Hash matches - skip setup
  return false
}

// ---------------------------------------------------------------------------
// SSE Client for Automatic Updates
// ---------------------------------------------------------------------------

let eventSource: EventSource | null = null

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
      break

    case 'update':
      performUpdate(message.files, message.timestamp)
      break

    case 'reload':
      window.location.reload()
      break
  }
}

function performUpdate(files: string[], timestamp: number) {
  // Re-import each affected component with cache-busting timestamp
  let updates = files.map(function (file) {
    let importUrl = file + '?t=' + timestamp
    return __hmr_update(file, function () {
      return import(importUrl)
    })
  })

  Promise.all(updates).catch(function (error) {
    console.error('[HMR] Update failed:', error)
  })
}

// ---------------------------------------------------------------------------
// Testing API
// ---------------------------------------------------------------------------

let isConnected = false

// Get connection status (for testing)
export function __hmr_get_connection_status(): boolean {
  return isConnected
}

// Get tracked handle count for a specific component (for testing)
export function __hmr_get_tracked_handle_count(moduleUrl: string, componentName: string): number {
  let moduleComponents = components.get(moduleUrl)
  if (!moduleComponents) return 0
  let component = moduleComponents.get(componentName)
  if (!component) return 0
  return component.handles.size
}

// ---------------------------------------------------------------------------
// Auto-connect (side effect)
// ---------------------------------------------------------------------------
// We connect automatically when this module is imported.
;(function connect() {
  let sseUrl = window.location.origin + '/__@remix/hmr-events'
  eventSource = new EventSource(sseUrl)

  eventSource.onopen = function () {
    isConnected = true
  }

  eventSource.onmessage = function (event) {
    let message = parseHmrMessage(event.data)
    if (message) {
      handleHmrMessage(message)
    }
  }

  eventSource.onerror = function () {
    // EventSource automatically reconnects
    isConnected = false
  }
})()
