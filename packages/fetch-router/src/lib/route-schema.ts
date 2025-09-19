import type { RoutePattern } from '@remix-run/route-pattern'

export type RouteDef = string | RoutePattern | RouteStub | RouteSchema

export interface RouteSchema {
  [RouteName: string]: RouteDef
}

export type RouteMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export interface RouteStub<T extends string = string> {
  method: RouteMethod
  pattern: T | RoutePattern<T>
}

export function isRouteStub(value: any): value is RouteStub {
  return (
    typeof value === 'object' &&
    value != null &&
    'method' in value &&
    typeof value.method === 'string' &&
    'pattern' in value &&
    value.pattern != null
  )
}

// prettier-ignore
export type ExtractRoutePattern<T extends RouteDef> =
  T extends string ? RoutePattern<T> :
  T extends RoutePattern ? T :
  T extends RouteStub<infer P extends string> ? RoutePattern<P> :
  T extends RouteSchema ?
    // If V is the bare RouteSchema, exclude to avoid recursion and union widening
    [RouteSchema] extends [T] ? never :
    ExtractRoutePattern<T[keyof T]> :
  never
