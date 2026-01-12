import { createSession, type Session } from '@remix-run/session'

import { AppStorage } from './app-storage.ts'
import {
  RequestBodyMethods,
  type RequestBodyMethod,
  type RequestMethod,
} from './request-methods.ts'

/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
export class RequestContext<
  method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  params extends Record<string, any> = {},
> {
  /**
   * @param request The incoming request
   */
  constructor(request: Request) {
    this.headers = new Headers(request.headers)
    this.method = request.method.toUpperCase() as RequestMethod
    this.params = {} as params
    this.request = request
    this.storage = new AppStorage()
    this.url = new URL(request.url)
  }

  /**
   * A map of files that were uploaded in the request.
   *
   * Note: For requests without a body (e.g. `GET` or `HEAD`), this map will be empty.
   */
  get files(): Map<string, File> {
    let files: Map<string, File> = new Map()

    if (this.#formData != null) {
      for (let [key, value] of this.#formData.entries()) {
        if (value instanceof File) {
          files.set(key, value)
        }
      }
    }

    return files
  }

  /**
   * Parsed [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) from the
   * request body.
   *
   * Note: This is only available for requests with a body (not `GET` or `HEAD`).
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
   */
  get formData(): method extends RequestBodyMethod ? FormData : FormData | undefined {
    if (this.#formData == null && RequestBodyMethods.includes(this.method as RequestBodyMethod)) {
      this.#formData = new FormData()
    }

    return this.#formData as any
  }

  set formData(value: FormData) {
    this.#formData = value
  }

  #formData?: FormData

  /**
   * The headers of the request.
   */
  headers: Headers

  /**
   * The request method. This may differ from `request.method` when using the `methodOverride`
   * middleware, which allows HTML forms to simulate RESTful API request methods like `PUT` and
   * `DELETE` using a hidden input field.
   */
  method: RequestMethod

  /**
   * Params that were parsed from the URL.
   */
  params: params

  /**
   * The original request that was dispatched to the router.
   *
   * Note: Various properties of the original request may not be available or may have been
   * modified by middleware. For example, the request's body may already have been consumed by
   * the `formData` middleware (available as `context.formData`), or its method may have been
   * overridden by the `methodOverride` middleware (available as `context.method`). You should
   * always default to using properties of the `context` object instead of the original request.
   * However, the original request is made available in case you need it for some edge case.
   */
  request: Request

  /**
   * The current session.
   */
  get session(): Session {
    if (this.#session == null) {
      console.warn(
        "Session isn't started yet, so session data won't be saved. Use the session() middleware to start the session.",
      )

      this.#session = createSession()
    }

    return this.#session
  }

  set session(value: Session) {
    this.#session = value
  }

  #session?: Session

  /**
   * Whether the session has been started.
   */
  get sessionStarted(): boolean {
    return this.#session != null
  }

  /**
   * Shared application-specific storage.
   */
  storage: AppStorage

  /**
   * The URL that was matched by the route.
   */
  url: URL
}
