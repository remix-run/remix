export { createStorageKey } from './lib/app-storage.ts'
export { AppStorage } from './lib/app-storage.ts'

export { RequestContext } from './lib/request-handler.ts'
export type { RequestHandler, Middleware, NextFunction } from './lib/request-handler.ts'

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

export { logger } from './lib/middleware/logger.ts'

export { Route, createRoutes } from './lib/route-map.ts'
export type { RouteMap, RouteDefs, RouteDef } from './lib/route-map.ts'

export { createRouter, Router } from './lib/router.ts'
export type { RouterOptions } from './lib/router.ts'

export { html } from './lib/utils/response.ts'
