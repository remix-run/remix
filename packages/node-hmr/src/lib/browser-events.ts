import process from 'node:process'

const eventUrlEnv = 'REMIX_NODE_HMR_EVENT_URL'

export const nodeHmrEventPathname = '/hmr'

export interface NodeHmrEndpoint {
  hostname: string
  pathname: string
  port: number
  url: string
}

export type NodeHmrBrowserPayload =
  | {
      type: 'connected'
    }
  | {
      data?: unknown
      event: string
      type: 'custom'
    }
  | {
      acceptedPath?: string
      path: string
      timestamp: number
      type: 'css-update' | 'full-reload' | 'js-update'
    }

export interface BrowserEventChannel {
  eventUrl: string
  send(payload: NodeHmrBrowserPayload): void
}

export const browserEventChannel: BrowserEventChannel | undefined = createBrowserEventChannel()

export function getNodeHmrEndpoint(): NodeHmrEndpoint | undefined {
  let eventUrl = getNodeHmrEventUrl()
  if (eventUrl === undefined) return undefined

  let url = new URL(eventUrl)
  let port = Number(url.port)
  if (!Number.isInteger(port)) return undefined

  return {
    hostname: url.hostname,
    pathname: url.pathname,
    port,
    url: eventUrl,
  }
}

export function getNodeHmrEventUrl(): string | undefined {
  let eventUrl = process.env[eventUrlEnv]
  return eventUrl && isHttpUrl(eventUrl) ? eventUrl : undefined
}

function createBrowserEventChannel(): BrowserEventChannel | undefined {
  let eventUrl = getNodeHmrEventUrl()
  if (eventUrl === undefined) return undefined

  return {
    eventUrl,
    send: sendNodeHmrBrowserPayload,
  }
}

export function sendNodeHmrBrowserPayload(payload: NodeHmrBrowserPayload): void {
  if (process.env.REMIX_NODE_HMR !== '1') return

  process.send?.({
    payload,
    type: 'browser-hmr:send',
  })
}

export function setNodeHmrEventUrlEnv(env: NodeJS.ProcessEnv, eventUrl: string): NodeJS.ProcessEnv {
  return {
    ...env,
    [eventUrlEnv]: eventUrl,
  }
}

function isHttpUrl(value: string): boolean {
  try {
    let url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
