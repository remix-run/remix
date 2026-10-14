import { createCookie } from 'remix/cookie'
import { createContextKey, type Middleware } from 'remix/router'

export interface DemoLatency {
  enabled: boolean
  duration: number
}

export const demoLatencyContext = createContextKey<DemoLatency>()

const demoLatencyCookie = createCookie('lazy-frames-latency', {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365,
  path: '/',
  sameSite: 'Lax',
})

const defaultDuration = process.env.NODE_ENV === 'test' ? 20 : 520

export function demoLatency(
  duration = defaultDuration,
): Middleware<{ key: typeof demoLatencyContext; value: DemoLatency }> {
  return async (context, next) => {
    let enabled = (await demoLatencyCookie.parse(context.headers.get('Cookie'))) === '1'
    context.set(demoLatencyContext, { enabled, duration })

    if (enabled) {
      await delay(duration, context.request.signal)
    }

    let response = await next()
    response.headers.append('Vary', 'Cookie')
    if (enabled) {
      response.headers.append('Server-Timing', `demo-latency;dur=${duration}`)
    }
    return response
  }
}

export function serializeDemoLatency(enabled: boolean): Promise<string> {
  return demoLatencyCookie.serialize(enabled ? '1' : '', enabled ? undefined : { maxAge: 0 })
}

function delay(duration: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason)

  return new Promise((resolve, reject) => {
    let timeout = setTimeout(finish, duration)

    function finish() {
      signal.removeEventListener('abort', abort)
      resolve()
    }

    function abort() {
      clearTimeout(timeout)
      reject(signal.reason)
    }

    signal.addEventListener('abort', abort, { once: true })
  })
}
