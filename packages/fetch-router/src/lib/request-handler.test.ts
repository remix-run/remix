import type { RoutePattern } from '@remix-run/route-pattern'

import type { RequestHandler, BuildRequestHandler } from './request-handler.ts'
import type { Assert, IsEqual } from './type-utils.ts'
import { Route } from './route-map.ts'

// prettier-ignore
type Tests = [
  Assert<IsEqual<BuildRequestHandler<'/users/:id'>, RequestHandler<'ANY', { id: string }>>>,
  Assert<IsEqual<BuildRequestHandler<RoutePattern<'users/:id'>>, RequestHandler<'ANY', { id: string }>>>,
  Assert<IsEqual<BuildRequestHandler<Route<'GET', '/users/:id'>>, RequestHandler<'GET', { id: string }>>>,
]
