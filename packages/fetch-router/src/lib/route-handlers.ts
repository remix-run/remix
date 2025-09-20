import type { RoutePattern } from '@remix-run/route-pattern'

import type { RequestContext } from './request-context.ts'
import type { RouteDef, RouteSchema, RouteStub } from './route-schema.ts'

export type RouteHandlers<S extends RouteSchema> = {
  [K in keyof S]: ExtractRouteHandler<S[K]>
}

// prettier-ignore
export type ExtractRouteHandler<T extends RouteDef> =
  T extends string ? RouteHandler<T> :
  T extends RoutePattern<infer P extends string> ? RouteHandler<P> :
  T extends RouteStub<infer P extends string> ? RouteHandler<P> :
  T extends RouteSchema ?
    // If T is the bare RouteSchema, exclude to avoid recursion and union widening
    [RouteSchema] extends [T] ? never :
    RouteHandlers<T> :
  never

export type RouteHandler<T extends string> = (
  ctx: RequestContext<T>,
) => Response | Promise<Response>
