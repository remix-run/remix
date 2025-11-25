export { createStorageKey } from './lib/app-storage.ts'
export { AppStorage } from './lib/app-storage.ts'

export {
  createFormAction,
  createFormAction as formAction, // shorthand
} from './lib/form-action.ts'

export type { Middleware, NextFunction } from './lib/middleware.ts'

export { RequestContext } from './lib/request-context.ts'

export { RequestMethods } from './lib/request-methods.ts'
export type { RequestMethod } from './lib/request-methods.ts'

export type { RequestHandler, InferRequestHandler } from './lib/request-handler.ts'

export {
  createResource,
  createResource as resource, // shorthand
} from './lib/resource.ts'
export type { ResourceMethod, ResourceOptions } from './lib/resource.ts'

export {
  createResources,
  createResources as resources, // shorthand
} from './lib/resources.ts'
export type { ResourcesMethod, ResourcesOptions } from './lib/resources.ts'

export type { RouteHandlers, RouteHandler, BuildRouteHandler } from './lib/route-handlers.ts'

export {
  Route,
  createRoutes,
  createRoutes as route, // shorthand
} from './lib/route-map.ts'
export type { RouteMap, RouteDefs, RouteDef } from './lib/route-map.ts'

export { createRouter } from './lib/router.ts'
export type { Router, RouterOptions } from './lib/router.ts'
