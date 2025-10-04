import type { RoutePattern } from '@remix-run/route-pattern'

import { createRoutes } from './route-map.ts'
import type { BuildRouteMap } from './route-map.ts'

export type ResourceMethod = 'show' | 'new' | 'create' | 'edit' | 'update' | 'destroy'

// prettier-ignore
export const ResourceMethods: readonly ResourceMethod[] = ['show', 'new', 'create', 'edit', 'update', 'destroy']

export interface ResourceOptions {
  /**
   * The resource methods to include in the route map. If not provided, all
   * methods (`show`, `new`, `create`, `edit`, `update`, and `destroy`) will be
   * included.
   */
  only?: ResourceMethod[]
  /**
   * Custom names to use for the resource routes.
   */
  routeNames?: {
    show?: string
    new?: string
    create?: string
    edit?: string
    update?: string
    destroy?: string
  }
}

/**
 * Create a route map with standard CRUD routes for a singleton resource.
 *
 * @param base The base route pattern to use for the resource
 * @param options Options to configure the resource routes
 */
export function createResource<P extends string, const O extends ResourceOptions>(
  base: P | RoutePattern<P>,
  options?: O,
): BuildResourceMap<P, O> {
  let only = options?.only ?? (ResourceMethods as readonly ResourceMethod[])
  let showName = options?.routeNames?.show ?? 'show'
  let newName = options?.routeNames?.new ?? 'new'
  let createName = options?.routeNames?.create ?? 'create'
  let editName = options?.routeNames?.edit ?? 'edit'
  let updateName = options?.routeNames?.update ?? 'update'
  let destroyName = options?.routeNames?.destroy ?? 'destroy'

  let routes: any = {}

  if (only.includes('show')) {
    routes[showName] = { method: 'GET', pattern: `/` }
  }
  if (only.includes('new')) {
    routes[newName] = { method: 'GET', pattern: `/new` }
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

  return createRoutes(base, routes) as BuildResourceMap<P, O>
}

type BuildResourceMap<B extends string, O extends ResourceOptions> = BuildRouteMap<
  B,
  BuildResourceRoutes<
    O,
    O extends { only: readonly ResourceMethod[] } ? O['only'][number] : ResourceMethod
  >
>

type BuildResourceRoutes<O extends ResourceOptions, M extends ResourceMethod> = {
  [K in M as GetRouteName<O, K>]: ResourceRoutes[K]
}

type GetRouteName<O extends ResourceOptions, M extends ResourceMethod> = M extends ResourceMethod
  ? O extends { routeNames: { [K in M]: infer N extends string } }
    ? N
    : M
  : never

type ResourceRoutes = {
  show: { method: 'GET'; pattern: `/` }
  new: { method: 'GET'; pattern: `/new` }
  create: { method: 'POST'; pattern: `/` }
  edit: { method: 'GET'; pattern: `/edit` }
  update: { method: 'PUT'; pattern: `/` }
  destroy: { method: 'DELETE'; pattern: `/` }
}

export type ResourcesMethod = 'index' | 'show' | 'new' | 'create' | 'edit' | 'update' | 'destroy'

// prettier-ignore
export const ResourcesMethods: readonly ResourcesMethod[] = ['index', 'show', 'new', 'create', 'edit', 'update', 'destroy']

export type ResourcesOptions = {
  /**
   * The resource methods to include in the route map. If not provided, all
   * methods (`index`, `show`, `new`, `create`, `edit`, `update`, and `destroy`)
   * will be included.
   */
  only?: ResourcesMethod[]
  /**
   * The parameter name to use for the resource. Defaults to `id`.
   */
  param?: string
  /**
   * Custom names to use for the resource routes.
   */
  routeNames?: {
    index?: string
    show?: string
    new?: string
    create?: string
    edit?: string
    update?: string
    destroy?: string
  }
}

/**
 * Create a route map with standard CRUD routes for a resource collection.
 *
 * @param base The base route pattern to use for the resources
 * @param options Options to configure the resource routes
 */
export function createResources<P extends string, const O extends ResourcesOptions>(
  base: P | RoutePattern<P>,
  options?: O,
): BuildResourcesMap<P, O> {
  let only = options?.only ?? (ResourcesMethods as readonly ResourcesMethod[])
  let param = options?.param ?? 'id'
  let indexName = options?.routeNames?.index ?? 'index'
  let showName = options?.routeNames?.show ?? 'show'
  let newName = options?.routeNames?.new ?? 'new'
  let createName = options?.routeNames?.create ?? 'create'
  let editName = options?.routeNames?.edit ?? 'edit'
  let updateName = options?.routeNames?.update ?? 'update'
  let destroyName = options?.routeNames?.destroy ?? 'destroy'

  let routes: any = {}

  if (only.includes('index')) {
    routes[indexName] = { method: 'GET', pattern: `/` }
  }
  if (only.includes('show')) {
    routes[showName] = { method: 'GET', pattern: `/:${param}` }
  }
  if (only.includes('new')) {
    routes[newName] = { method: 'GET', pattern: `/new` }
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

  return createRoutes(base, routes) as BuildResourcesMap<P, O>
}

type BuildResourcesMap<B extends string, O extends ResourcesOptions> = BuildRouteMap<
  B,
  BuildResourcesRoutes<
    O,
    O extends { only: readonly ResourcesMethod[] } ? O['only'][number] : ResourcesMethod,
    GetParam<O>
  >
>

type BuildResourcesRoutes<
  O extends ResourcesOptions,
  M extends ResourcesMethod,
  Param extends string,
> = {
  [K in M as GetResourcesRouteName<O, K>]: ResourcesRoutes<Param>[K]
}

type GetResourcesRouteName<
  O extends ResourcesOptions,
  M extends ResourcesMethod,
> = M extends ResourcesMethod
  ? O extends { routeNames: { [K in M]: infer N extends string } }
    ? N
    : M
  : never

type ResourcesRoutes<Param extends string> = {
  index: { method: 'GET'; pattern: `/` }
  show: { method: 'GET'; pattern: `/:${Param}` }
  new: { method: 'GET'; pattern: `/new` }
  create: { method: 'POST'; pattern: `/` }
  edit: { method: 'GET'; pattern: `/:${Param}/edit` }
  update: { method: 'PUT'; pattern: `/:${Param}` }
  destroy: { method: 'DELETE'; pattern: `/:${Param}` }
}

type GetParam<O extends ResourcesOptions> = O extends { param: infer P extends string } ? P : 'id'
