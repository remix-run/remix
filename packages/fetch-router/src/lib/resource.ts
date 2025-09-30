import { createRoutes } from './router.ts'
import type { Route } from './router.ts'
import type { Simplify } from './type-utils.ts'

export function createResource<B extends string, const O extends ResourceOptions>(
  base: B,
  options?: O,
): Simplify<ResourceRouteMap<B, O>> {
  let opts = options ?? ({} as O)
  let only = opts.only ?? []
  let methodsToCreate: readonly ResourceMethod[] = only.length > 0 ? [...only] : ResourceMethods
  let routeDefs: any = {}

  for (let method of methodsToCreate) {
    if (method === 'new') {
      routeDefs.new = { method: 'GET', pattern: `/${base}/new` }
    } else if (method === 'create') {
      routeDefs.create = { method: 'POST', pattern: `/${base}` }
    } else if (method === 'show') {
      routeDefs.show = { method: 'GET', pattern: `/${base}` }
    } else if (method === 'edit') {
      routeDefs.edit = { method: 'GET', pattern: `${base}/edit` }
    } else if (method === 'update') {
      routeDefs.update = { method: 'PUT', pattern: `/${base}` }
    } else if (method === 'destroy') {
      routeDefs.destroy = { method: 'DELETE', pattern: `/${base}` }
    }
  }

  return createRoutes(routeDefs) as any
}

export interface ResourceOptions {
  only?: readonly ResourceMethod[]
}

// prettier-ignore
const ResourceMethods: readonly ResourceMethod[] = ['new', 'create', 'show', 'edit', 'update', 'destroy'] as const
type ResourceMethod = 'new' | 'create' | 'show' | 'edit' | 'update' | 'destroy'

type ResourceRouteMap<B extends string, O extends ResourceOptions> = BuildResourceRouteMap<
  B,
  O extends { only: infer Only extends readonly ResourceMethod[] } ? Only : typeof ResourceMethods
>

// prettier-ignore
type BuildResourceRouteMap<
  Base extends string,
  Methods extends readonly ResourceMethod[],
> = {
  [
    K in ResourceMethod as K extends Methods[number] ? K : never
  ]: (
    K extends 'new' ? Route<'GET', `/${Base}/new`> :
    K extends 'create' ? Route<'POST', `/${Base}`> :
    K extends 'show' ? Route<'GET', `/${Base}`> :
    K extends 'edit' ? Route<'GET', `/${Base}/edit`> :
    K extends 'update' ? Route<'PUT', `/${Base}`> :
    K extends 'destroy' ? Route<'DELETE', `/${Base}`> :
    never
  )
}

export function createResources<B extends string, const O extends ResourcesOptions>(
  base: B,
  options?: O,
): Simplify<ResourcesRouteMap<B, O>> {
  let opts = options ?? ({} as O)
  let param = opts.param ?? 'id'
  let only = opts.only ?? []

  let methodsToCreate: readonly ResourcesMethod[] = only.length > 0 ? [...only] : ResourcesMethods
  let routeDefs: any = {}

  for (let method of methodsToCreate) {
    if (method === 'index') {
      routeDefs.index = { method: 'GET', pattern: `/${base}` }
    } else if (method === 'new') {
      routeDefs.new = { method: 'GET', pattern: `/${base}/new` }
    } else if (method === 'create') {
      routeDefs.create = { method: 'POST', pattern: `/${base}` }
    } else if (method === 'show') {
      routeDefs.show = { method: 'GET', pattern: `/${base}/:${param}` }
    } else if (method === 'edit') {
      routeDefs.edit = { method: 'GET', pattern: `/${base}/:${param}/edit` }
    } else if (method === 'update') {
      routeDefs.update = { method: 'PUT', pattern: `/${base}/:${param}` }
    } else if (method === 'destroy') {
      routeDefs.destroy = { method: 'DELETE', pattern: `/${base}/:${param}` }
    }
  }

  return createRoutes(routeDefs) as any
}

export interface ResourcesOptions {
  param?: string
  only?: readonly ResourcesMethod[]
}

// prettier-ignore
const ResourcesMethods: readonly ResourcesMethod[] = ['index', 'new', 'create', 'show', 'edit', 'update', 'destroy'] as const
type ResourcesMethod = 'index' | 'new' | 'create' | 'show' | 'edit' | 'update' | 'destroy'

type ResourcesRouteMap<B extends string, O extends ResourcesOptions> = BuildResourcesRouteMap<
  B,
  O extends { param: infer P extends string } ? P : 'id',
  O extends { only: infer Only extends readonly ResourcesMethod[] } ? Only : typeof ResourcesMethods
>

// prettier-ignore
type BuildResourcesRouteMap<
  Base extends string,
  Param extends string,
  Methods extends readonly ResourcesMethod[],
> = {
  [
    K in ResourcesMethod as K extends Methods[number] ? K : never
  ]: (
    K extends 'index' ? Route<'GET', `/${Base}`> :
    K extends 'new' ? Route<'GET', `/${Base}/new`> :
    K extends 'create' ? Route<'POST', `/${Base}`> :
    K extends 'show' ? Route<'GET', `/${Base}/:${Param}`> :
    K extends 'edit' ? Route<'GET', `/${Base}/:${Param}/edit`> :
    K extends 'update' ? Route<'PUT', `/${Base}/:${Param}`> :
    K extends 'destroy' ? Route<'DELETE', `/${Base}/:${Param}`> :
    never
  )
}
