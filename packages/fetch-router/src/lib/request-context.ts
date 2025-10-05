import { AppStorage } from './app-storage.ts'

export interface RequestContextOptions<Params extends Record<string, any> = {}> {
  files?: Record<string, File>
  formData?: FormData
  params?: Params
  request: Request
  storage?: AppStorage
  url?: URL
}

/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
export class RequestContext<Params extends Record<string, any> = {}> {
  /**
   * Files that were uploaded in the request body. This is only available if the `formData` middleware
   * has been used.
   */
  readonly files: Record<string, File> | undefined
  /**
   * Parsed `FormData` object from the request body. This is only available if the `formData` middleware
   * has been used.
   */
  readonly formData: FormData | undefined
  /**
   * Params that were parsed from the URL.
   */
  readonly params: Params
  /**
   * The original request that was dispatched to the router.
   */
  readonly request: Request
  /**
   * Shared application-specific storage.
   */
  readonly storage: AppStorage
  /**
   * The URL that was matched by the route.
   *
   * Note: This may be different from the original request URL if the request was routed to a
   * downstream router.
   */
  readonly url: URL

  constructor(options: RequestContextOptions<Params> | Request) {
    let request: Request
    if (options instanceof Request) {
      request = options
      options = {} as RequestContextOptions<Params>
    } else {
      request = options.request
    }

    this.files = options.files
    this.formData = options.formData
    this.params = options.params ?? ({} as Params)
    this.request = request
    this.storage = options.storage ?? new AppStorage()
    this.url = options.url ?? new URL(request.url)
  }
}
