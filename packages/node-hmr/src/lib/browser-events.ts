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

export interface HmrEventChannel {
  url: string
  send(payload: NodeHmrBrowserPayload): void
}

export const eventChannel: HmrEventChannel | undefined = createBrowserEventChannel()

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
  let url = process.env[eventUrlEnv]
  return url && isHttpUrl(url) ? url : undefined
}

function createBrowserEventChannel(): HmrEventChannel | undefined {
  let url = getNodeHmrEventUrl()
  if (url === undefined) return undefined

  return {
    url,
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

export function setNodeHmrEventUrlEnv(env: NodeJS.ProcessEnv, url: string): NodeJS.ProcessEnv {
  return {
    ...env,
    [eventUrlEnv]: url,
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
