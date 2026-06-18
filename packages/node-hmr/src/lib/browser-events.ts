import process from 'node:process'

import { hasNodeHmrParentProcess } from './process-state.ts'

export const defaultBrowserEventControllerPathname = '/hmr'

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

export type HmrBrowserIntent =
  | {
      files?: string[]
      timestamp: number
      type: 'update'
      updates: HmrBrowserUpdate[]
    }
  | {
      files?: string[]
      reason?: string
      type: 'reload'
    }

export type BrowserHmrFileEvent = {
  event: 'add' | 'change' | 'unlink'
  filePath: string
}

export interface BrowserEventSource {
  handleFileEvents(events: readonly BrowserHmrFileEvent[]): Promise<readonly HmrBrowserIntent[]>
}

export interface BrowserEventSourceRegistration {
  close(): void
  updateWatchedFiles(delta: { add: readonly string[]; remove: readonly string[] }): void
}

export interface BrowserEventController {
  register(source: BrowserEventSource): BrowserEventSourceRegistration
  url: string
}

export function sendHmrEventPayload(payload: HmrEventPayload): void {
  if (!hasNodeHmrParentProcess()) return

  process.send?.({
    payload,
    type: 'node-hmr:child:browser-event-emitted',
  })
}
