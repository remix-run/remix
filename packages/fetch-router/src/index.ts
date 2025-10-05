export { createStorageKey } from './lib/app-storage.ts'
export { AppStorage } from './lib/app-storage.ts'

export {
  createFormAction,
  createFormAction as formAction, // shorthand
} from './lib/form-action.ts'

export type { Middleware, NextFunction } from './lib/middleware.ts'

export { html, json, redirect } from './lib/response-helpers.ts'

// Only export the type here, not the class. The `RequestContext` instance is
// internal and managed by the router. Users should not need to make their own
// instances of this class.
export type { RequestContext } from './lib/request-context.ts'

export { RequestMethods } from './lib/request-methods.ts'
export type { RequestMethod } from './lib/request-methods.ts'

export type { RequestHandler } from './lib/request-handler.ts'

export {
  createResource,
  createResource as resource, // shorthand
  createResources,
  createResources as resources, // shorthand
} from './lib/resource.ts'
export type {
  ResourceMethod,
  ResourceOptions,
  ResourcesMethod,
  ResourcesOptions,
} from './lib/resource.ts'

export type { RouteHandlers, RouteHandler } from './lib/route-handlers.ts'

export {
  Route,
  createRoutes,
  createRoutes as route, // shorthand
} from './lib/route-map.ts'
export type { RouteMap, RouteDefs, RouteDef } from './lib/route-map.ts'

export { createRouter, Router } from './lib/router.ts'
export type { RouterOptions } from './lib/router.ts'
