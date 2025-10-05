import FindMyWay from 'find-my-way'

interface BenchData {
  name: string
  handler: string
}

/**
 * Wrapper for find-my-way router (used by Fastify)
 */
export class FindMyWayMatcher {
  #router: ReturnType<typeof FindMyWay>

  constructor() {
    this.#router = FindMyWay()
  }

  add(pattern: string, data: BenchData): void {
    // find-my-way uses a handler function, store data in the route
    this.#router.on('GET', pattern, () => data)
  }

  match(url: string | URL): { data: BenchData; params: any } | null {
    if (typeof url === 'string') url = new URL(url)

    let pathname = url.pathname

    let result = this.#router.find('GET', pathname)
    if (!result) return null

    return {
      data: result.handler(),
      params: result.params,
    }
  }

  get size(): number {
    // find-my-way doesn't expose a size property, track manually
    return this.#router.prettyPrint().split('\n').length - 2
  }
}
