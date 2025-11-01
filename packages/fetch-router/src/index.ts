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
  createResources,
  createResources as resources, // shorthand
} from './lib/resource.ts'
export type {
  ResourceMethod,
  ResourceOptions,
  ResourcesMethod,
  ResourcesOptions,
} from './lib/resource.ts'

export type { RouteHandlers, RouteHandler, BuildRouteHandler } from './lib/route-handlers.ts'

export {
  createDestroy,
  createDestroy as destroy, // shorthand
  createGet,
  createGet as get, // shorthand
  createHead,
  createHead as head, // shorthand
  createOptions,
  createOptions as options, // shorthand
  createPatch,
  createPatch as patch, // shorthand
  createPost,
  createPost as post, // shorthand
  createPut,
  createPut as put, // shorthand
} from './lib/route-helpers.ts'

export {
  Route,
  createRoutes,
  createRoutes as route, // shorthand
} from './lib/route-map.ts'
export type { RouteMap, RouteDefs, RouteDef } from './lib/route-map.ts'

export { createRouter, Router } from './lib/router.ts'
export type { RouterOptions } from './lib/router.ts'
