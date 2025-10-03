import type { RoutePattern } from '@remix-run/route-pattern'

import { createRoutes } from './route-map.ts'
import type { BuildRouteMap } from './route-map.ts'

export type ResourceMethod = 'show' | 'new' | 'create' | 'edit' | 'update' | 'destroy'

// prettier-ignore
export const ResourceMethods: readonly ResourceMethod[] = ['show', 'new', 'create', 'edit', 'update', 'destroy']

export interface ResourceOptions {
  only?: ResourceMethod[]
}

export function createResource<P extends string, const O extends ResourceOptions>(
  base: P | RoutePattern<P>,
  options?: O,
): BuildResourceMap<P, O> {
  let only = options?.only ?? (ResourceMethods as readonly ResourceMethod[])

  let routes: any = {}

  if (only.includes('show')) {
    routes.show = { method: 'GET', pattern: `/:id` }
  }
  if (only.includes('new')) {
    routes.new = { method: 'GET', pattern: `/new` }
  }
  if (only.includes('create')) {
    routes.create = { method: 'POST', pattern: `/` }
  }
  if (only.includes('edit')) {
    routes.edit = { method: 'GET', pattern: `/:id/edit` }
  }
  if (only.includes('update')) {
    routes.update = { method: 'PUT', pattern: `/:id` }
  }
  if (only.includes('destroy')) {
    routes.destroy = { method: 'DELETE', pattern: `/:id` }
  }

  return createRoutes(base, routes) as BuildResourceMap<P, O>
}

type BuildResourceMap<B extends string, O extends ResourceOptions> = BuildRouteMap<
  B,
  Pick<AllResourceRoutes, IncludedResourceMethods<O>>
>

// prettier-ignore
type AllResourceRoutes = {
  show: { method: 'GET'; pattern: `/:id` }
  new: { method: 'GET'; pattern: `/new` }
  create: { method: 'POST'; pattern: `/` }
  edit: { method: 'GET'; pattern: `/:id/edit` }
  update: { method: 'PUT'; pattern: `/:id` }
  destroy: { method: 'DELETE'; pattern: `/:id` }
}

// prettier-ignore
type IncludedResourceMethods<O extends ResourceOptions> =
  O extends { only: readonly ResourceMethod[] }
    ? O['only'][number]
    : ResourceMethod

export type ResourcesMethod = 'index' | 'show' | 'new' | 'create' | 'edit' | 'update' | 'destroy'

// prettier-ignore
export const ResourcesMethods: readonly ResourcesMethod[] = ['index', 'show', 'new', 'create', 'edit', 'update', 'destroy']

export type ResourcesOptions = {
  only?: ResourcesMethod[]
  param?: string
}

export function createResources<P extends string, const O extends ResourcesOptions>(
  base: P | RoutePattern<P>,
  options?: O,
): BuildResourcesMap<P, O> {
  let only = options?.only ?? (ResourcesMethods as readonly ResourcesMethod[])
  let param = options?.param ?? 'id'

  let routes: any = {}

  if (only.includes('index')) {
    routes.index = { method: 'GET', pattern: `/` }
  }
  if (only.includes('show')) {
    routes.show = { method: 'GET', pattern: `/:${param}` }
  }
  if (only.includes('new')) {
    routes.new = { method: 'GET', pattern: `/new` }
  }
  if (only.includes('create')) {
    routes.create = { method: 'POST', pattern: `/` }
  }
  if (only.includes('edit')) {
    routes.edit = { method: 'GET', pattern: `/:${param}/edit` }
  }
  if (only.includes('update')) {
    routes.update = { method: 'PUT', pattern: `/:${param}` }
  }
  if (only.includes('destroy')) {
    routes.destroy = { method: 'DELETE', pattern: `/:${param}` }
  }

  return createRoutes(base, routes) as BuildResourcesMap<P, O>
}

type BuildResourcesMap<B extends string, O extends ResourcesOptions> = BuildRouteMap<
  B,
  Pick<AllResourcesRoutes<GetParam<O>>, IncludedResourcesMethods<O>>
>

type GetParam<O extends ResourcesOptions> = O extends { param: infer P extends string } ? P : 'id'

// prettier-ignore
type AllResourcesRoutes<Param extends string> = {
  index: { method: 'GET'; pattern: `/` }
  show: { method: 'GET'; pattern: `/:${Param}` }
  new: { method: 'GET'; pattern: `/new` }
  create: { method: 'POST'; pattern: `/` }
  edit: { method: 'GET'; pattern: `/:${Param}/edit` }
  update: { method: 'PUT'; pattern: `/:${Param}` }
  destroy: { method: 'DELETE'; pattern: `/:${Param}` }
}

// prettier-ignore
type IncludedResourcesMethods<O extends ResourcesOptions> =
  O extends { only: readonly ResourcesMethod[] }
    ? O['only'][number]
    : ResourcesMethod
