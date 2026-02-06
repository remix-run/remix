export {
  Route,
  createRoutes,
  createRoutes as route, // shorthand
} from './lib/route-map.ts'
export type { BuildRoute, RouteMap, RouteDefs, RouteDef } from './lib/route-map.ts'

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
