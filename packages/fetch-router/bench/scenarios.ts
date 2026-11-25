import { bench, describe } from 'vitest'

interface Scenario {
  name: string
  routeCount: number
  url: string
  status: number
  params?: Record<string, string>
  middleware?: 'sync' | 'async'
}

export type CreateFetch = (
  scenario: Scenario,
  verify: boolean,
) => (request: Request) => Response | Promise<Response>

const scenarios: Scenario[] = [
  { name: 'Static route, 100 routes', routeCount: 100, url: '/', status: 200 },
  {
    name: 'One param, 100 routes',
    routeCount: 100,
    url: '/api/v1/resource42/123',
    status: 200,
    params: { id: '123' },
  },
  {
    name: 'One param, 1,000 routes',
    routeCount: 1000,
    url: '/api/v1/resource420/123',
    status: 200,
    params: { id: '123' },
  },
  { name: 'Not found, 1,000 routes', routeCount: 1000, url: '/missing/path', status: 404 },
  {
    name: '3 sync middleware, 100 routes',
    routeCount: 100,
    url: '/',
    status: 200,
    middleware: 'sync',
  },
  {
    name: '3 async middleware, 100 routes',
    routeCount: 100,
    url: '/',
    status: 200,
    middleware: 'async',
  },
]

// Benchmark handlers return this pre-created response without reading params, since some routers
// parse params only when a handler asks for them.
export const okResponse = new Response('ok')

// The root route plus alternating list and show routes, such as `/api/v1/resource1` and
// `/api/v1/resource1/:id`, until there are `count` routes.
export function generatePatterns(count: number): string[] {
  let patterns = ['/']
  for (let index = 0; patterns.length < count; index++) {
    patterns.push(`/api/v1/resource${index}`)
    if (patterns.length < count) patterns.push(`/api/v1/resource${index}/:id`)
  }
  return patterns
}

/**
 * Verifies a router against every scenario, then benchmarks it. Each router has its own bench file
 * so Vitest runs it in a separate process, where it can't affect the other router's results.
 */
export async function benchRouter(name: string, createFetch: CreateFetch): Promise<void> {
  for (let scenario of scenarios) {
    // Every scenario reuses one request, so results measure dispatch rather than request parsing.
    let request = new Request(new URL(scenario.url, 'https://example.com'))

    let response = await createFetch(scenario, true)(request)
    if (response.status !== scenario.status) {
      throw new Error(
        `${name} returned ${response.status} for "${scenario.name}", expected ${scenario.status}`,
      )
    }
    if (scenario.params !== undefined) {
      let params = JSON.stringify(await response.json())
      if (params !== JSON.stringify(scenario.params)) {
        throw new Error(`${name} returned params ${params} for "${scenario.name}"`)
      }
    }

    describe(scenario.name, () => {
      let fetch = createFetch(scenario, false)
      // Vitest awaits a returned promise, so this measures async routers to completion without adding
      // an `await` to routers that respond synchronously.
      let run: () => void = () => fetch(request)
      bench(name, run)
    })
  }
}
