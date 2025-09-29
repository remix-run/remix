import { createRoutes } from './router.ts'
import type { Route } from './router.ts'
import type { Simplify } from './type-utils.ts'

export function createResource<N extends string, const O extends ResourceOptions>(
  name: N,
  options?: O,
): Simplify<ResourceRouteMap<N, O>> {
  let opts = options ?? ({} as O)
  let base = opts.base ?? ''
  let only = opts.only ?? []
  let methodsToCreate: readonly ResourceMethod[] = only.length > 0 ? [...only] : ResourceMethods
  let routeDefs: any = {}

  for (let method of methodsToCreate) {
    if (method === 'new') {
      routeDefs.new = { method: 'GET', pattern: `${base}/${name}/new` }
    } else if (method === 'create') {
      routeDefs.create = { method: 'POST', pattern: `${base}/${name}` }
    } else if (method === 'show') {
      routeDefs.show = { method: 'GET', pattern: `${base}/${name}` }
    } else if (method === 'edit') {
      routeDefs.edit = { method: 'GET', pattern: `${base}/${name}/edit` }
    } else if (method === 'update') {
      routeDefs.update = { method: 'PUT', pattern: `${base}/${name}` }
    } else if (method === 'destroy') {
      routeDefs.destroy = { method: 'DELETE', pattern: `${base}/${name}` }
    }
  }

  return createRoutes(routeDefs) as any
}

export interface ResourceOptions {
  base?: string
  only?: readonly ResourceMethod[]
}

// prettier-ignore
const ResourceMethods: readonly ResourceMethod[] = ['new', 'create', 'show', 'edit', 'update', 'destroy'] as const
type ResourceMethod = 'new' | 'create' | 'show' | 'edit' | 'update' | 'destroy'

type ResourceRouteMap<N extends string, O extends ResourceOptions> = BuildResourceRouteMap<
  N,
  O extends { base: infer B extends string } ? B : '',
  O extends { only: infer Only extends readonly ResourceMethod[] } ? Only : typeof ResourceMethods
>

// prettier-ignore
type BuildResourceRouteMap<
  N extends string,
  Base extends string,
  Methods extends readonly ResourceMethod[],
> = {
  [
    K in ResourceMethod as K extends Methods[number] ? K : never
  ]: (
    K extends 'new' ? Route<'GET', `${Base}/${N}/new`> :
    K extends 'create' ? Route<'POST', `${Base}/${N}`> :
    K extends 'show' ? Route<'GET', `${Base}/${N}`> :
    K extends 'edit' ? Route<'GET', `${Base}/${N}/edit`> :
    K extends 'update' ? Route<'PUT', `${Base}/${N}`> :
    K extends 'destroy' ? Route<'DELETE', `${Base}/${N}`> :
    never
  )
}

export function createResources<N extends string, const O extends ResourcesOptions>(
  name: N,
  options?: O,
): Simplify<ResourcesRouteMap<N, O>> {
  let opts = options ?? ({} as O)
  let base = opts.base ?? ''
  let param = opts.param ?? 'id'
  let only = opts.only ?? []

  let methodsToCreate: readonly ResourcesMethod[] = only.length > 0 ? [...only] : ResourcesMethods
  let routeDefs: any = {}

  for (let method of methodsToCreate) {
    if (method === 'index') {
      routeDefs.index = { method: 'GET', pattern: `${base}/${name}` }
    } else if (method === 'new') {
      routeDefs.new = { method: 'GET', pattern: `${base}/${name}/new` }
    } else if (method === 'create') {
      routeDefs.create = { method: 'POST', pattern: `${base}/${name}` }
    } else if (method === 'show') {
      routeDefs.show = { method: 'GET', pattern: `${base}/${name}/:${param}` }
    } else if (method === 'edit') {
      routeDefs.edit = { method: 'GET', pattern: `${base}/${name}/:${param}/edit` }
    } else if (method === 'update') {
      routeDefs.update = { method: 'PUT', pattern: `${base}/${name}/:${param}` }
    } else if (method === 'destroy') {
      routeDefs.destroy = { method: 'DELETE', pattern: `${base}/${name}/:${param}` }
    }
  }

  return createRoutes(routeDefs) as any
}

export interface ResourcesOptions {
  base?: string
  param?: string
  only?: readonly ResourcesMethod[]
}

// prettier-ignore
const ResourcesMethods: readonly ResourcesMethod[] = ['index', 'new', 'create', 'show', 'edit', 'update', 'destroy'] as const
type ResourcesMethod = 'index' | 'new' | 'create' | 'show' | 'edit' | 'update' | 'destroy'

type ResourcesRouteMap<N extends string, O extends ResourcesOptions> = BuildResourcesRouteMap<
  N,
  O extends { base: infer B extends string } ? B : '',
  O extends { param: infer P extends string } ? P : 'id',
  O extends { only: infer Only extends readonly ResourcesMethod[] } ? Only : typeof ResourcesMethods
>

// prettier-ignore
type BuildResourcesRouteMap<
  N extends string,
  Base extends string,
  Param extends string,
  Methods extends readonly ResourcesMethod[],
> = {
  [
    K in ResourcesMethod as K extends Methods[number] ? K : never
  ]: (
    K extends 'index' ? Route<'GET', `${Base}/${N}`> :
    K extends 'new' ? Route<'GET', `${Base}/${N}/new`> :
    K extends 'create' ? Route<'POST', `${Base}/${N}`> :
    K extends 'show' ? Route<'GET', `${Base}/${N}/:${Param}`> :
    K extends 'edit' ? Route<'GET', `${Base}/${N}/:${Param}/edit`> :
    K extends 'update' ? Route<'PUT', `${Base}/${N}/:${Param}`> :
    K extends 'destroy' ? Route<'DELETE', `${Base}/${N}/:${Param}`> :
    never
  )
}
