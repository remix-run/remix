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
  if (!hasNodeHmrParentProcess()) return

  process.send?.({
    event,
    type: 'server-hmr:event',
  })
}
