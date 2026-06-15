import process from 'node:process'

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
  if (process.env.REMIX_NODE_HMR !== '1') return

  process.send?.({
    payload,
    type: 'hmr-event:send',
  })
}
