import type { RoutePattern } from '@remix-run/route-pattern'

import type { RouteSchema, RouteStub } from './route-schema.ts'

export type RoutePatterns<T extends RouteSchema> = ExtractRoutePattern<T[keyof T]>

// Distributive helper that extracts RoutePattern from any supported schema value
// prettier-ignore
type ExtractRoutePattern<V> =
  V extends string ? RoutePattern<V> :
  V extends RoutePattern<string> ? V :
  V extends RouteStub<infer P extends string> ? RoutePattern<P> :
  V extends RouteSchema ?
    // If V is the bare RouteSchema, exclude to avoid recursion and union widening
    [RouteSchema] extends [V] ? never :
    RoutePatterns<V> :
  never
