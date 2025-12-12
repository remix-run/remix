import type { RoutePattern } from '@remix-run/route-pattern'

import { type BuildRouteMap, createRoutes } from '../route-map.ts'

export type ResourceMethod = 'new' | 'show' | 'create' | 'edit' | 'update' | 'destroy'

// prettier-ignore
export const ResourceMethods = ['new', 'show', 'create', 'edit', 'update', 'destroy'] as const

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
      /**
       * The resource methods to exclude from the route map.
       * Cannot be used together with `only`.
       */
      exclude?: ResourceMethod[]
      only?: never
    }
)

/**
 * Create a route map with standard CRUD routes for a singleton resource.
 *
 * @param base The base route pattern to use for the resource
 * @param options Options to configure the resource routes
 * @returns The route map with CRUD routes
 */
export function createResourceRoutes<base extends string, const options extends ResourceOptions>(
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
    only = ResourceMethods.filter((m) => !options.exclude!.includes(m))
  } else {
    only = ResourceMethods
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
