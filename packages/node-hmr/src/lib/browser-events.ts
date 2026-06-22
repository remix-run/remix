import process from 'node:process'

import { hasNodeHmrParentProcess } from './process-state.ts'

export const defaultBrowserHmrPathname = '/hmr'

export interface HmrEventPayload {
  type: string
  [key: string]: unknown
}

export type HmrBrowserUpdate =
  | {
      acceptedPath?: string
      path: string
      type: 'js'
    }
  | {
      path: string
      type: 'css'
    }

export type BrowserHmrEvent =
  | {
      files?: string[]
      timestamp: number
      type: 'update'
      updates: HmrBrowserUpdate[]
    }
  | {
      files?: string[]
      type: 'reload'
    }

export type BrowserHmrFileEvent = {
  event: 'add' | 'change' | 'unlink'
  filePath: string
}

export type BrowserHmrFileEventHandler = (
  events: readonly BrowserHmrFileEvent[],
) => Promise<readonly BrowserHmrEvent[]>

export interface BrowserHmrWatchedFileDelta {
  add: readonly string[]
  remove: readonly string[]
}

export interface BrowserHmrChannel {
  readonly url: string
  close(): void
  onFileEvents(handler: BrowserHmrFileEventHandler): () => void
  updateWatchedFiles(delta: BrowserHmrWatchedFileDelta): void
}

export function sendHmrEventPayload(payload: HmrEventPayload): void {
  if (!hasNodeHmrParentProcess()) return

  process.send?.({
    payload,
    type: 'node-hmr:child:browser-event-emitted',
  })
}
