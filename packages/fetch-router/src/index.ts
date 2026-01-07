export { createStorageKey } from './lib/app-storage.ts'
export { AppStorage } from './lib/app-storage.ts'

export type { Controller, Action, BuildAction, RequestHandler } from './lib/controller.ts'

export type { Middleware, NextFunction } from './lib/middleware.ts'

export { RequestContext } from './lib/request-context.ts'

export { RequestMethods } from './lib/request-methods.ts'
export type { RequestMethod } from './lib/request-methods.ts'

export {
  Route,
  createRoutes,
} from './lib/route-map.ts'
export type { BuildRoute, RouteMap, RouteDefs, RouteDef } from './lib/route-map.ts'

export { createHandlers, createRouter } from './lib/router.ts'
export type { MatchData, Router, RouterOptions, Handlers, LegacyRouter } from './lib/router.ts'

// Route helpers

export {
  createDeleteRoute,
  createDeleteRoute as del, // shorthand
  createGetRoute,
  createGetRoute as get, // shorthand
  createHeadRoute,
  createHeadRoute as head, // shorthand
  createOptionsRoute,
  createOptionsRoute as options, // shorthand
  createPatchRoute,
  createPatchRoute as patch, // shorthand
  createPostRoute,
  createPostRoute as post, // shorthand
  createPutRoute,
  createPutRoute as put, // shorthand
} from './lib/route-helpers/method.ts'

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
