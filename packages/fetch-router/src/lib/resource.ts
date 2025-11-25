import type { RoutePattern } from '@remix-run/route-pattern'

import { createRoutes } from './route-map.ts'
import type { BuildRouteMap } from './route-map.ts'

export const ResourceMethods = ['new', 'show', 'create', 'edit', 'update', 'destroy'] as const
export type ResourceMethod = (typeof ResourceMethods)[number]

export type ResourceOptions = {
  /**
   * Custom names to use for the resource routes.
   */
  names?: {
    new?: string
    show?: string
    create?: string
    edit?: string
    update?: string
    destroy?: string
  }
} & (
  | {
  /**
   * The resource methods to include in the route map. If not provided, all
   * methods (`show`, `new`, `create`, `edit`, `update`, and `destroy`) will be
   * included.
   * Cannot be used together with `exclude`.
   */
  only?: ResourceMethod[]

  exclude?: never
}
  | {
  only?: never

  /**
   * The resource methods to exclude from the route map.
   * Cannot be used together with `only`.
   */
  exclude?: ResourceMethod[]
}
  )

/**
 * Create a route map with standard CRUD routes for a singleton resource.
 *
 * @param base The base route pattern to use for the resource
 * @param options Options to configure the resource routes
 */
export function createResource<base extends string, const options extends ResourceOptions>(
  base: base | RoutePattern<base>,
  options?: options,
): BuildResourceMap<base, options> {
  // Runtime validation
  if (options?.only && options?.exclude) {
    throw new Error('Cannot specify both "only" and "exclude" options')
  }

  // Resolve which methods to include
  let only: readonly ResourceMethod[]
  if (options?.only) {
    only = options.only
  } else if (options?.exclude) {
    only = ResourceMethods.filter(m => !options.exclude!.includes(m))
  } else {
    only = ResourceMethods as readonly ResourceMethod[]
  }

  let newName = options?.names?.new ?? 'new'
  let showName = options?.names?.show ?? 'show'
  let createName = options?.names?.create ?? 'create'
  let editName = options?.names?.edit ?? 'edit'
  let updateName = options?.names?.update ?? 'update'
  let destroyName = options?.names?.destroy ?? 'destroy'

  let routes: any = {}

  if (only.includes('new')) {
    routes[newName] = { method: 'GET', pattern: `/new` }
  }
  if (only.includes('show')) {
    routes[showName] = { method: 'GET', pattern: `/` }
  }
  if (only.includes('create')) {
    routes[createName] = { method: 'POST', pattern: `/` }
  }
  if (only.includes('edit')) {
    routes[editName] = { method: 'GET', pattern: `/edit` }
  }
  if (only.includes('update')) {
    routes[updateName] = { method: 'PUT', pattern: `/` }
  }
  if (only.includes('destroy')) {
    routes[destroyName] = { method: 'DELETE', pattern: `/` }
  }

  return createRoutes(base, routes) as BuildResourceMap<base, options>
}

type BuildResourceMap<base extends string, options extends ResourceOptions> = BuildRouteMap<
  base,
  BuildResourceRoutes<
    options,
    options extends { only: readonly ResourceMethod[] }
      ? options['only'][number]
      : options extends { exclude: readonly ResourceMethod[] }
        ? Exclude<ResourceMethod, options['exclude'][number]>
        : ResourceMethod
  >
>

type BuildResourceRoutes<options extends ResourceOptions, method extends ResourceMethod> = {
  [methodName in method as GetRouteName<options, methodName>]: ResourceRoutes[methodName]
}

type GetRouteName<
  options extends ResourceOptions,
  method extends ResourceMethod,
> = method extends ResourceMethod
  ? options extends { names: { [methodName in method]: infer customName extends string } }
    ? customName
    : method
  : never

type ResourceRoutes = {
  new: { method: 'GET'; pattern: `/new` }
  show: { method: 'GET'; pattern: `/` }
  create: { method: 'POST'; pattern: `/` }
  edit: { method: 'GET'; pattern: `/edit` }
  update: { method: 'PUT'; pattern: `/` }
  destroy: { method: 'DELETE'; pattern: `/` }
}

// prettier-ignore
export const ResourcesMethods = ['index', 'new', 'show', 'create', 'edit', 'update', 'destroy'] as const
export type ResourcesMethod = (typeof ResourcesMethods)[number]

export type ResourcesOptions = {
  /**
   * The parameter name to use for the resource. Defaults to `id`.
   */
  param?: string
  /**
   * Custom names to use for the resource routes.
   */
  names?: {
    index?: string
    new?: string
    show?: string
    create?: string
    edit?: string
    update?: string
    destroy?: string
  }
} & (
  | {
  /**
   * The resource methods to include in the route map. If not provided, all
   * methods (`index`, `show`, `new`, `create`, `edit`, `update`, and `destroy`)
   * will be included.
   * Cannot be used together with `exclude`.
   */
  only?: ResourcesMethod[]

  exclude?: never
}
  | {
  only?: never

  /**
   * The resource methods to exclude from the route map.
   * Cannot be used together with `only`.
   */
  exclude?: ResourcesMethod[]
}
  )

/**
 * Create a route map with standard CRUD routes for a resource collection.
 *
 * @param base The base route pattern to use for the resources
 * @param options Options to configure the resource routes
 */
export function createResources<base extends string, const options extends ResourcesOptions>(
  base: base | RoutePattern<base>,
  options?: options,
): BuildResourcesMap<base, options> {
  // Runtime validation
  if (options?.only && options?.exclude) {
    throw new Error('Cannot specify both "only" and "exclude" options')
  }

  // Resolve which methods to include
  let only: readonly ResourcesMethod[]
  if (options?.only) {
    only = options.only
  } else if (options?.exclude) {
    only = ResourcesMethods.filter(m => !options.exclude!.includes(m))
  } else {
    only = ResourcesMethods as readonly ResourcesMethod[]
  }

  let param = options?.param ?? 'id'
  let indexName = options?.names?.index ?? 'index'
  let newName = options?.names?.new ?? 'new'
  let showName = options?.names?.show ?? 'show'
  let createName = options?.names?.create ?? 'create'
  let editName = options?.names?.edit ?? 'edit'
  let updateName = options?.names?.update ?? 'update'
  let destroyName = options?.names?.destroy ?? 'destroy'

  let routes: any = {}

  if (only.includes('index')) {
    routes[indexName] = { method: 'GET', pattern: `/` }
  }
  if (only.includes('new')) {
    routes[newName] = { method: 'GET', pattern: `/new` }
  }
  if (only.includes('show')) {
    routes[showName] = { method: 'GET', pattern: `/:${param}` }
  }
  if (only.includes('create')) {
    routes[createName] = { method: 'POST', pattern: `/` }
  }
  if (only.includes('edit')) {
    routes[editName] = { method: 'GET', pattern: `/:${param}/edit` }
  }
  if (only.includes('update')) {
    routes[updateName] = { method: 'PUT', pattern: `/:${param}` }
  }
  if (only.includes('destroy')) {
    routes[destroyName] = { method: 'DELETE', pattern: `/:${param}` }
  }

  return createRoutes(base, routes) as BuildResourcesMap<base, options>
}

type BuildResourcesMap<base extends string, options extends ResourcesOptions> = BuildRouteMap<
  base,
  BuildResourcesRoutes<
    options,
    options extends { only: readonly ResourcesMethod[] }
      ? options['only'][number]
      : options extends { exclude: readonly ResourcesMethod[] }
        ? Exclude<ResourcesMethod, options['exclude'][number]>
        : ResourcesMethod,
    GetParam<options>
  >
>

// prettier-ignore
type BuildResourcesRoutes<
  options extends ResourcesOptions,
  method extends ResourcesMethod,
  param extends string,
> = {
  [methodName in method as GetResourcesRouteName<options, methodName>]: ResourcesRoutes<param>[methodName]
}

type GetResourcesRouteName<
  options extends ResourcesOptions,
  method extends ResourcesMethod,
> = method extends ResourcesMethod
  ? options extends { names: { [methodName in method]: infer customName extends string } }
    ? customName
    : method
  : never

type ResourcesRoutes<param extends string> = {
  index: { method: 'GET'; pattern: `/` }
  new: { method: 'GET'; pattern: `/new` }
  show: { method: 'GET'; pattern: `/:${param}` }
  create: { method: 'POST'; pattern: `/` }
  edit: { method: 'GET'; pattern: `/:${param}/edit` }
  update: { method: 'PUT'; pattern: `/:${param}` }
  destroy: { method: 'DELETE'; pattern: `/:${param}` }
}

// prettier-ignore
type GetParam<options extends ResourcesOptions> =
  options extends { param: infer param extends string } ? param : 'id'