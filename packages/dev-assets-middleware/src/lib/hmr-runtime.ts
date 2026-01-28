/**
 * HMR Runtime Module
 *
 * This is served at /__@remix/hmr/runtime.js by the middleware.
 * Components import from this module to access HMR functions.
 *
 * This approach:
 * - Keeps source maps intact (no post-transform string replacements)
 * - Uses standard ESM imports instead of window globals
 */

export function generateRuntimeModule(): string {
  return `
// =============================================================================
// HMR Runtime Module (served by @remix-run/dev-assets-middleware)
// =============================================================================

// ---------------------------------------------------------------------------
// JSX Runtime
// These are needed for dynamically imported components that can't bundle
// the jsx-runtime themselves.
// ---------------------------------------------------------------------------

export function jsx(type, props, key) {
  return { type: type, props: props, key: key, $rmx: true };
}

export const jsxs = jsx;

export function Fragment() {
  return function(_) { return null; };
}

// ---------------------------------------------------------------------------
// HMR State Storage (WeakMap keeps handle clean)
// ---------------------------------------------------------------------------

const hmrState = new WeakMap();

export function __hmr_state(handle) {
  if (!hmrState.has(handle)) {
    hmrState.set(handle, {});
  }
  return hmrState.get(handle);
}

export function __hmr_clear_state(handle) {
  hmrState.delete(handle);
}

// ---------------------------------------------------------------------------
// HMR Registry
// ---------------------------------------------------------------------------

// Nested map: semantic structure organized by URL, then component name
// url → Map<name, { impl: componentFn, handles: Set<handle> }>
const components = new Map();

// Fast lookup from handle to its metadata
// handle → { url, name, renderFn }
const handleToComponent = new WeakMap();

export function __hmr_register(moduleUrl, componentName, handle, renderFn) {
  // Store handle metadata for fast lookup
  handleToComponent.set(handle, { url: moduleUrl, name: componentName, renderFn: renderFn });

  // Ensure component entry exists in nested map
  if (!components.has(moduleUrl)) {
    components.set(moduleUrl, new Map());
  }
  const moduleComponents = components.get(moduleUrl);
  if (!moduleComponents.has(componentName)) {
    moduleComponents.set(componentName, { impl: null, handles: new Set() });
  }
  
  // Add handle to the component's handle set
  moduleComponents.get(componentName).handles.add(handle);
}

export function __hmr_call(handle, ...args) {
  const metadata = handleToComponent.get(handle);
  if (!metadata) {
    throw new Error('[HMR] No render function registered for handle');
  }
  return metadata.renderFn(...args);
}

// Register a component function in the registry
// Called by transforms: allows remount to use the current implementation
export function __hmr_register_component(moduleUrl, componentName, componentFn) {
  // Ensure component entry exists
  if (!components.has(moduleUrl)) {
    components.set(moduleUrl, new Map());
  }
  const moduleComponents = components.get(moduleUrl);
  if (!moduleComponents.has(componentName)) {
    moduleComponents.set(componentName, { impl: null, handles: new Set() });
  }
  
  // Store the implementation
  moduleComponents.get(componentName).impl = componentFn;
}

// Get the current component function from the registry
// Called by the delegating wrapper that Remix holds
export function __hmr_get_component(moduleUrl, componentName) {
  const moduleComponents = components.get(moduleUrl);
  if (!moduleComponents) return undefined;
  
  const component = moduleComponents.get(componentName);
  return component ? component.impl : undefined;
}

export function __hmr_update(moduleUrl, getNewModule) {
  const moduleComponents = components.get(moduleUrl);
  if (!moduleComponents || moduleComponents.size === 0) {
    console.log('[HMR] No instances found for ' + moduleUrl);
    return Promise.resolve();
  }

  console.log('[HMR] Updating ' + moduleUrl + '...');

  return getNewModule().then(function(newModule) {
    // NOTE: The module load itself calls __hmr_register_component with the impl.
    // We do NOT call it here - that would overwrite the impl with the wrapper!

    moduleComponents.forEach(function(component, componentName) {
      const newComponentFn = newModule[componentName];
      if (!newComponentFn) {
        console.warn('[HMR] Component ' + componentName + ' not found in new module');
        return;
      }

      console.log('[HMR] Updating ' + componentName + ' (' + component.handles.size + ' instance(s))');

      component.handles.forEach(function(handle) {
        try {
          // This calls the wrapper, which delegates to __hmr_get_component,
          // which returns the impl that was registered when the module loaded.
          newComponentFn(handle);
          handle.update();
        } catch (error) {
          console.error('[HMR] Error updating ' + componentName + ':', error);
        }
      });
    });

    console.log('[HMR] Update complete for ' + moduleUrl);
  });
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
 */
export function __hmr_setup(handle, state, hash, setupFn) {
  if (state.__setupHash === undefined) {
    // First run - execute setup and store hash
    setupFn();
    state.__setupHash = hash;
    return false;
  }
  if (state.__setupHash !== hash) {
    // Hash changed - clear state and signal remount needed
    console.warn('[HMR] Setup scope changed, component will remount');
    __hmr_clear_state(handle);
    return true;
  }
  // Hash matches - skip setup
  return false;
}

// ---------------------------------------------------------------------------
// SSE Client for Automatic Updates
// ---------------------------------------------------------------------------

let eventSource = null;

export function __hmr_request_remount(handle) {
  // Use global set by entry point (avoids module import issues with bundlers)
  if (window.__hmr_request_remount_impl) {
    window.__hmr_request_remount_impl(handle);
  } else {
    console.warn('[HMR] requestRemount not available - set window.__hmr_request_remount_impl in your entry');
  }
}

function handleHmrMessage(message) {
  switch (message.type) {
    case 'connected':
      console.log('[HMR] Server connection established');
      break;

    case 'update':
      if (message.files && message.files.length > 0) {
        console.log('[HMR] Received update for:', message.files);
        performUpdate(message.files, message.timestamp);
      }
      break;

    case 'reload':
      console.log('[HMR] Full reload requested');
      window.location.reload();
      break;

    default:
      console.log('[HMR] Unknown message type:', message.type);
  }
}

function performUpdate(files, timestamp) {
  // Re-import each affected component with cache-busting timestamp
  const updates = files.map(function(file) {
    const importUrl = file + '?t=' + timestamp;
    console.log('[HMR] Re-importing ' + importUrl);

    return __hmr_update(file, function() {
      return import(importUrl);
    });
  });

  Promise.all(updates)
    .then(function() {
      console.log('[HMR] All updates complete');
    })
    .catch(function(error) {
      console.error('[HMR] Update failed:', error);
      console.log('[HMR] Consider a full page reload');
    });
}

// ---------------------------------------------------------------------------
// Connection Status (for testing)
// ---------------------------------------------------------------------------

window.__hmr_connected = false;

// ---------------------------------------------------------------------------
// Auto-connect (side effect)
// ---------------------------------------------------------------------------
// We connect automatically when this module is imported.
// This simplifies HTML injection to just: <script type="module" src="/__@remix/hmr/runtime.js">

(function connect() {
  const sseUrl = window.location.origin + '/__@remix/hmr';
  console.log('[HMR] Connecting to ' + sseUrl);

  eventSource = new EventSource(sseUrl);

  eventSource.onopen = function() {
    console.log('[HMR] Connected');
    window.__hmr_connected = true;
  };

  eventSource.onmessage = function(event) {
    try {
      const message = JSON.parse(event.data);
      handleHmrMessage(message);
    } catch (error) {
      console.error('[HMR] Failed to parse message:', error);
    }
  };

  eventSource.onerror = function() {
    // EventSource automatically reconnects, just log it
    console.log('[HMR] Connection lost, reconnecting...');
    window.__hmr_connected = false;
  };
})();

console.log('[HMR] Runtime loaded');
`.trim()
}
