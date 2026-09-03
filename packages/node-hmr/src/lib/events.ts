import process from 'node:process'

import { hasNodeHmrParentProcess } from './process-state.ts'

export type ServerHmrEvent =
  | {
      acceptedUrl?: string
      filePath: string
      timestamp: number
      type: 'update'
      url: string
    }
  | {
      filePath?: string
      reason?: string
      timestamp: number
      type: 'restart'
      url?: string
    }

export interface ServerHmrEventSource {
  subscribe(listener: (event: ServerHmrEvent) => void): () => void
}

type ServerHmrEventListener = (event: ServerHmrEvent) => void

class ServerHmrEvents implements ServerHmrEventSource {
  #listeners = new Set<ServerHmrEventListener>()

  subscribe(listener: ServerHmrEventListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  emit(event: ServerHmrEvent): void {
    for (let listener of this.#listeners) {
      listener(event)
    }
  }
}

export const serverHmrEvents = new ServerHmrEvents()

export function emitServerHmrEvent(event: ServerHmrEvent): void {
  serverHmrEvents.emit(event)
}

export function emitServerHmrUpdate(event: Extract<ServerHmrEvent, { type: 'update' }>): void {
  emitServerHmrEvent(event)
  if (!hasNodeHmrParentProcess()) return

  process.send?.({
    acceptedUrl: event.acceptedUrl,
    filePath: event.filePath,
    timestamp: event.timestamp,
    type: 'node-hmr:child:hot-module-updated',
    url: event.url,
  })
}
