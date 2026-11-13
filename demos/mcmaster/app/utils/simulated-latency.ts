import { setTimeout } from 'node:timers/promises'

import { readSpeedSettings } from './speed-settings.ts'

type FetchHandler = (request: Request) => Promise<Response>

/**
 * Delays each incoming request by the visitor's simulated latency before the router sees it.
 * Localhost answers in about a millisecond, which hides the round trips that prefetching and
 * caching are designed to avoid. Wrapping the server's handler, rather than adding router
 * middleware, keeps the delay at the network boundary so `render()`'s internal frame requests
 * are not delayed a second time.
 */
export function withSimulatedLatency(handler: FetchHandler): FetchHandler {
  return async (request) => {
    let { latency } = await readSpeedSettings(request.headers.get('Cookie'))
    if (latency > 0) await setTimeout(latency)
    return handler(request)
  }
}
