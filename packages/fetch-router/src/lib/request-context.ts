import { AppStorage } from './app-storage.ts'
import type { RequestBodyMethod, RequestMethod } from './request-methods.ts'

/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
export class RequestContext<
  Method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  Params extends Record<string, any> = {},
> {
  /**
   * Parsed `FormData` object from the request body.
   *
   * Note: This is only available for requests with a body (not `GET` or `HEAD`).
   */
  formData: Method extends RequestBodyMethod ? FormData : undefined
  /**
   * The request method. This may differ from `request.method` if the request body
   * contained a method override field (e.g. `_method=DELETE`), allowing HTML forms to simulate
   * RESTful API request methods like PUT and DELETE.
   */
  method: RequestMethod
  /**
   * Params that were parsed from the URL.
   */
  params: Params
  /**
   * The original request that was dispatched to the router.
   */
  request: Request
  /**
   * Shared application-specific storage.
   */
  storage: AppStorage
  /**
   * The URL that was matched by the route.
   *
   * Note: This may be different from `request.url` if the request was routed to a
   * sub-router, in which case the URL mount point is stripped from the pathname.
   */
  url: URL

  constructor(request: Request) {
    this.formData = undefined as any
    this.method = request.method.toUpperCase() as RequestMethod
    this.params = {} as Params
    this.request = request
    this.storage = new AppStorage()
    this.url = new URL(request.url)
  }

  /**
   * The headers of the request.
   */
  get headers(): Headers {
    // TODO: Make this a SuperHeaders object?
    return this.request.headers
  }

  /**
   * Files that were uploaded in the request body, in a map.
   */
  get files(): Map<string, File> | null {
    let formData = this.formData

    if (formData == null) {
      return null
    }

    let files: Map<string, File> = new Map()

    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        files.set(key, value)
      }
    }

    return files
  }
}
