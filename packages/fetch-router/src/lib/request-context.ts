import { AppStorage } from './app-storage.ts'

/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
export class RequestContext<Params extends Record<string, any> = {}> {
  /**
   * The original request that was dispatched to the router.
   */
  readonly request: Request
  /**
   * The URL that was matched by the route.
   *
   * Note: This may be different from the original request URL if the request was routed to a
   * downstream router.
   */
  readonly url: URL
  /**
   * Params that were parsed from the URL.
   */
  readonly params: Params
  /**
   * Shared application-specific storage.
   */
  readonly storage: AppStorage

  constructor(
    request: Request,
    url: URL,
    params: Params = {} as Params,
    storage = new AppStorage(),
  ) {
    this.request = request
    this.url = url
    this.params = params
    this.storage = storage
  }
}
