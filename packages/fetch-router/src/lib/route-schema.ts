import type { RoutePattern } from '@remix-run/route-pattern'

export type RouteDef = string | RoutePattern | RouteStub | RouteSchema

export interface RouteSchema {
  [RouteName: string]: RouteDef
}

export type RequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export interface RouteStub<T extends string = string> {
  method?: RequestMethod
  pattern: T | RoutePattern<T>
}

export function isRouteStub(value: any): value is RouteStub {
  return typeof value === 'object' && value != null && 'pattern' in value && value.pattern != null
}
