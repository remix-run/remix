/**
 * Server-Sent Events for HMR
 *
 * Handles SSE connections from the browser HMR client.
 * Sends file change notifications to trigger hot updates.
 *
 * SSE is simpler than WebSocket for our use case:
 * - One-way communication (server → client) is all we need
 * - Fits naturally into the middleware pattern (just a Response)
 * - No special server setup required
 * - Works in any runtime (Node, Deno, Bun, Cloudflare Workers)
 * - Built-in reconnection in EventSource API
 */

export interface HmrMessage {
  type: 'update' | 'reload' | 'connected'
  /** Affected component module URLs */
  files?: string[]
  /** Timestamp of the change */
  timestamp?: number
}

export interface SseClient {
  id: number
  controller: ReadableStreamDefaultController<Uint8Array>
}

export interface HmrEventSource {
  /** Create a new SSE response for a client connection */
  connect(): Response
  /** Send an update message to all connected clients */
  sendUpdate(files: string[], timestamp: number): void
  /** Send a full reload message to all connected clients */
  sendReload(): void
  /** Get the number of connected clients */
  getClientCount(): number
}

let encoder = new TextEncoder()
let clientIdCounter = 0

/**
 * Create an HMR event source manager.
 *
 * Unlike WebSocket, this doesn't need a server reference.
 * Each client connection is just a streaming HTTP response.
 *
 * @param debug Whether to enable debug logging
 * @returns An HMR event source manager
 */
export function createHmrEventSource(debug: boolean = false): HmrEventSource {
  let clients = new Map<number, SseClient>()

  function log(...args: unknown[]) {
    if (debug) {
      console.log('[HMR]', ...args)
    }
  }

  function formatSseMessage(message: HmrMessage): string {
    return `data: ${JSON.stringify(message)}\n\n`
  }

  function broadcast(message: HmrMessage) {
    let data = encoder.encode(formatSseMessage(message))
    for (let [id, client] of clients) {
      try {
        client.controller.enqueue(data)
      } catch {
        // Client disconnected, remove it
        clients.delete(id)
      }
    }
  }

  return {
    connect() {
      let clientId = ++clientIdCounter

      let stream = new ReadableStream<Uint8Array>({
        start(controller) {
          // Register the client
          clients.set(clientId, { id: clientId, controller })
          log(`Client connected (${clients.size} total)`)

          // Send connected message
          let message: HmrMessage = { type: 'connected' }
          controller.enqueue(encoder.encode(formatSseMessage(message)))
        },
        cancel() {
          // Client disconnected
          clients.delete(clientId)
          log(`Client disconnected (${clients.size} remaining)`)
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    },

    sendUpdate(files: string[], timestamp: number) {
      if (clients.size === 0) {
        log('No clients connected, skipping update')
        return
      }

      log(`Sending update to ${clients.size} client(s): ${files.join(', ')}`)
      broadcast({ type: 'update', files, timestamp })
    },

    sendReload() {
      log(`Sending reload to ${clients.size} client(s)`)
      broadcast({ type: 'reload' })
    },

    getClientCount() {
      return clients.size
    },
  }
}
