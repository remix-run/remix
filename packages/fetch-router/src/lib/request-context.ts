import type { Params, RoutePattern } from '@remix-run/route-pattern'

import type { RouteDef, RouteStub, RouteSchema } from './route-schema.ts'
import { AppContext } from './app-context.ts'

export class RequestContext<T extends string> {
  readonly context: AppContext
  readonly request: Request
  readonly params: Params<T>
  readonly url: URL

  constructor(request: Request, params: Params<T>, url: URL) {
    this.context = new AppContext()
    this.request = request
    this.params = params
    this.url = url
  }
}

// prettier-ignore
export type ExtractRequestContext<T extends RouteDef> =
  T extends string ? RequestContext<T> :
  T extends RoutePattern<infer P extends string> ? RequestContext<P> :
  T extends RouteStub<infer P extends string> ? RequestContext<P> :
  T extends RouteSchema ?
    // If T is the bare RouteSchema, exclude to avoid recursion and union widening
    [RouteSchema] extends [T] ? never :
    ExtractRequestContext<T[keyof T]> :
  never
