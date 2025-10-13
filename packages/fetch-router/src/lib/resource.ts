import type { Join } from '@remix-run/route-pattern'
import { RoutePattern } from '@remix-run/route-pattern'

import type { RequestMethod } from './request-methods.ts'
import type { RouteDefs } from './route-map.ts'
import { createRoutes, Route } from './route-map.ts'
import type { BuildRouteMap } from './route-map.ts'
import type { Simplify } from './type-utils.ts'

export const ResourceMethods = ['new', 'show', 'create', 'edit', 'update', 'destroy'] as const
export type ResourceMethod = (typeof ResourceMethods)[number]

export interface ResourceOptions {
  children?: RouteDefs
  /**
   * The resource methods to include in the route map. If not provided, all
   * methods (`show`, `new`, `create`, `edit`, `update`, and `destroy`) will be
   * included.
   */
  only?: ResourceMethod[]
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
  let newName = options?.names?.new ?? 'new'
  let showName = options?.names?.show ?? 'show'
  let createName = options?.names?.create ?? 'create'
  let editName = options?.names?.edit ?? 'edit'
  let updateName = options?.names?.update ?? 'update'
  let destroyName = options?.names?.destroy ?? 'destroy'

  let routes: RouteDefs = options?.children ?? {}

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

  return createRoutes(base, routes) as BuildResourceMap<P, O>
}

type BuildResourceMap<B extends string, O extends ResourceOptions> = BuildRouteMap<
  B,
  (O extends { children: infer C extends RouteDefs } ? C : {}) &
    BuildResourceRoutes<
      O,
      O extends { only: readonly ResourceMethod[] } ? O['only'][number] : ResourceMethod
    >
>

type BuildResourceRoutes<O extends ResourceOptions, M extends ResourceMethod> = {
  [K in M as GetRouteName<O, K>]: ResourceRoutes[K]
}

type GetRouteName<O extends ResourceOptions, M extends ResourceMethod> = M extends ResourceMethod
  ? O extends { names: { [K in M]: infer N extends string } }
    ? N
    : M
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
  children?: RouteDefs
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
  names?: {
    index?: string
    new?: string
    show?: string
    create?: string
    edit?: string
    update?: string
    destroy?: string
  }
}

const addParamToPatterns = (defs: RouteDefs, param: string): RouteDefs =>
  Object.fromEntries(
    Object.entries(defs).map(([key, value]) => {
      let updatedValue =
        value instanceof Route
          ? new Route(value.method, new RoutePattern(`:${param}`).join(value.pattern))
          : typeof value === 'string' || value instanceof RoutePattern
            ? new RoutePattern(`:${param}`).join(value)
            : typeof value === 'object' && 'pattern' in value
              ? { ...value, pattern: new RoutePattern(`:${param}`).join((value as any).pattern) }
              : addParamToPatterns(value, param)

      return [key, updatedValue]
    }),
  )

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
  let indexName = options?.names?.index ?? 'index'
  let newName = options?.names?.new ?? 'new'
  let showName = options?.names?.show ?? 'show'
  let createName = options?.names?.create ?? 'create'
  let editName = options?.names?.edit ?? 'edit'
  let updateName = options?.names?.update ?? 'update'
  let destroyName = options?.names?.destroy ?? 'destroy'

  let routes: RouteDefs = addParamToPatterns(options?.children ?? {}, param)

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

  return createRoutes(base, routes) as BuildResourcesMap<P, O>
}

type AddParamToPatterns<RouteDefinitions extends RouteDefs, Param extends string> = Simplify<{
  [K in keyof RouteDefinitions]: RouteDefinitions[K] extends Route<
    infer Method extends RequestMethod | 'ANY',
    infer Pattern extends string
  >
    ? Route<Method, Join<`:${Param}`, Pattern>>
    : RouteDefinitions[K] extends string
      ? Join<`:${Param}`, RouteDefinitions[K]>
      : RouteDefinitions[K] extends RoutePattern<infer Pattern extends string>
        ? RoutePattern<Join<`:${Param}`, Pattern>>
        : RouteDefinitions[K] extends { method: infer Method; pattern: infer Pattern }
          ? {
              method: Method
              pattern: Pattern extends string
                ? Join<`:${Param}`, Pattern>
                : Pattern extends RoutePattern<infer P extends string>
                  ? Join<`:${Param}`, P>
                  : never
            }
          : RouteDefinitions[K] extends RouteDefs
            ? AddParamToPatterns<RouteDefinitions[K], Param>
            : never
}>

type BuildResourcesMap<
  B extends string,
  O extends ResourcesOptions,
  Param extends GetParam<O> = GetParam<O>,
> = BuildRouteMap<
  B,
  AddParamToPatterns<O extends { children: RouteDefs } ? O['children'] : {}, Param> &
    BuildResourcesRoutes<
      O,
      O extends { only: readonly ResourcesMethod[] } ? O['only'][number] : ResourcesMethod,
      Param
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
  ? O extends { names: { [K in M]: infer N extends string } }
    ? N
    : M
  : never

type ResourcesRoutes<Param extends string> = {
  index: { method: 'GET'; pattern: `/` }
  new: { method: 'GET'; pattern: `/new` }
  show: { method: 'GET'; pattern: `/:${Param}` }
  create: { method: 'POST'; pattern: `/` }
  edit: { method: 'GET'; pattern: `/:${Param}/edit` }
  update: { method: 'PUT'; pattern: `/:${Param}` }
  destroy: { method: 'DELETE'; pattern: `/:${Param}` }
}

type GetParam<O extends ResourcesOptions> = O extends { param: infer P extends string } ? P : 'id'
