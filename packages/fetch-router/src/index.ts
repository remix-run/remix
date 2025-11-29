export { createStorageKey } from './lib/app-storage.ts'
export { AppStorage } from './lib/app-storage.ts'

export type { Middleware, NextFunction } from './lib/middleware.ts'

export { RequestContext } from './lib/request-context.ts'

export { RequestMethods } from './lib/request-methods.ts'
export type { RequestMethod } from './lib/request-methods.ts'

export type { RequestHandler, BuildRequestHandler } from './lib/request-handler.ts'

export type { Controller, Action, BuildAction } from './lib/controller.ts'

export {
  Route,
  createRoutes,
  createRoutes as route, // shorthand
} from './lib/route-map.ts'
export type { RouteMap, RouteDefs, RouteDef } from './lib/route-map.ts'

export { createRouter } from './lib/router.ts'
export type { Router, RouterOptions } from './lib/router.ts'

// Route helpers

export {
  createFormRoutes,
  createFormRoutes as form, // shorthand
} from './lib/route-helpers/form.ts'
export type { FormOptions } from './lib/route-helpers/form.ts'

export {
  createResourceRoutes,
  createResourceRoutes as resource, // shorthand
} from './lib/route-helpers/resource.ts'
export type { ResourceMethod, ResourceOptions } from './lib/route-helpers/resource.ts'

export {
  createResourcesRoutes,
  createResourcesRoutes as resources, // shorthand
} from './lib/route-helpers/resources.ts'
export type { ResourcesMethod, ResourcesOptions } from './lib/route-helpers/resources.ts'
