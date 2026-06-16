import process from 'node:process'

import { hasNodeHmrParentProcess } from './process-state.ts'

export const defaultBrowserEventChannelPathname = '/hmr'

export interface HmrEventPayload {
  type: string
  [key: string]: unknown
}

export interface BrowserEventChannel {
  url: string
  send(payload: HmrEventPayload): void
}

export function sendHmrEventPayload(payload: HmrEventPayload): void {
  if (!hasNodeHmrParentProcess()) return

  process.send?.({
    payload,
    type: 'node-hmr:child:browser-event-emitted',
  })
}
