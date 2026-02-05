// =============================================================================
// HMR Runtime Module (served by @remix-run/dev-assets-middleware)
// =============================================================================
// This module re-exports the core HMR runtime from @remix-run/component-hmr
// and adds the SSE client for browser-based HMR updates.

// Import for internal use
import { __hmr_update } from '@remix-run/component-hmr/runtime'

// Re-export core HMR runtime functions for external consumers
export {
  __hmr_state,
  __hmr_clear_state,
  __hmr_register,
  __hmr_call,
  __hmr_register_component,
  __hmr_get_component,
  __hmr_update,
  __hmr_setup,
  __hmr_get_tracked_handle_count,
} from '@remix-run/component-hmr/runtime'

// ---------------------------------------------------------------------------
// Types for SSE client
// ---------------------------------------------------------------------------

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
