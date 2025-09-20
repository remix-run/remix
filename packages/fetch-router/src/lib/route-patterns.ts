import type { RoutePattern } from '@remix-run/route-pattern'

import type { RouteDef, RouteSchema, RouteStub } from './route-schema.ts'

// prettier-ignore
export type ExtractRoutePattern<T extends RouteDef> =
  T extends string ? RoutePattern<T> :
  T extends RoutePattern<string> ? T :
  T extends RouteStub<infer P extends string> ? RoutePattern<P> :
  T extends RouteSchema ?
    // If T is the bare RouteSchema, exclude to avoid recursion and union widening
    [RouteSchema] extends [T] ? never :
    ExtractRoutePattern<T[keyof T]> :
  never
