import { RoutePattern } from '@remix-run/route-pattern'

import { createRoutes } from './router.ts'
import type { Route } from './router.ts'
import type { Simplify } from './type-utils.ts'

// Resource ////////////////////////////////////////////////////////////////////////////////////////

export type ResourceMethod = 'new' | 'create' | 'show' | 'edit' | 'update' | 'destroy'

// prettier-ignore
const ResourceMethods: readonly ResourceMethod[] = ['new', 'create', 'show', 'edit', 'update', 'destroy'] as const

export function createResource<B extends string, const O extends ResourceOptions>(
  base: B | RoutePattern<B>,
  options?: O,
): ResourceRouteMap<B, O> {
  let only = options?.only ?? []
  let methodsToCreate: readonly ResourceMethod[] = only.length > 0 ? [...only] : ResourceMethods
  let routeDefs: any = {}

  let pattern = typeof base === 'string' ? new RoutePattern(base) : base

  for (let method of methodsToCreate) {
    if (method === 'new') {
      routeDefs.new = { method: 'GET', pattern: pattern.join('new') }
    } else if (method === 'create') {
      routeDefs.create = { method: 'POST', pattern }
    } else if (method === 'show') {
      routeDefs.show = { method: 'GET', pattern }
    } else if (method === 'edit') {
      routeDefs.edit = { method: 'GET', pattern: pattern.join('edit') }
    } else if (method === 'update') {
      routeDefs.update = { method: 'PUT', pattern }
    } else if (method === 'destroy') {
      routeDefs.destroy = { method: 'DELETE', pattern }
    }
  }

  return createRoutes(routeDefs) as any
}

export interface ResourceOptions {
  only?: readonly ResourceMethod[]
}

export type ResourceRouteMap<B extends string, O extends ResourceOptions> = BuildResourceRouteMap<
  B,
  O extends { only: infer Only extends readonly ResourceMethod[] }
    ? Only
    : readonly ResourceMethod[]
>

// prettier-ignore
type BuildResourceRouteMap<
  Base extends string,
  Methods extends readonly ResourceMethod[],
> = {
  [
    K in ResourceMethod as K extends Methods[number] ? K : never
  ]: (
    // TODO: Use Join<Base, P> to get precise pattern types
    K extends 'new' ? Route<'GET', `/${Base}/new`> :
    K extends 'create' ? Route<'POST', `/${Base}`> :
    K extends 'show' ? Route<'GET', `/${Base}`> :
    K extends 'edit' ? Route<'GET', `/${Base}/edit`> :
    K extends 'update' ? Route<'PUT', `/${Base}`> :
    K extends 'destroy' ? Route<'DELETE', `/${Base}`> :
    never
  )
}

// Resources ///////////////////////////////////////////////////////////////////////////////////////

export type ResourcesMethod = 'index' | 'new' | 'create' | 'show' | 'edit' | 'update' | 'destroy'

// prettier-ignore
const ResourcesMethods: readonly ResourcesMethod[] = ['index', 'new', 'create', 'show', 'edit', 'update', 'destroy'] as const

export function createResources<B extends string, const O extends ResourcesOptions>(
  base: B | RoutePattern<B>,
  options?: O,
): ResourcesRouteMap<B, O> {
  let only = options?.only ?? []
  let param = options?.param ?? 'id'
  let methodsToCreate: readonly ResourcesMethod[] = only.length > 0 ? [...only] : ResourcesMethods
  let routeDefs: any = {}

  let collectionPattern = typeof base === 'string' ? new RoutePattern(base) : base
  let memberPattern = collectionPattern.join(`:${param}`)

  for (let method of methodsToCreate) {
    if (method === 'index') {
      routeDefs.index = { method: 'GET', pattern: collectionPattern }
    } else if (method === 'new') {
      routeDefs.new = { method: 'GET', pattern: collectionPattern.join('new') }
    } else if (method === 'create') {
      routeDefs.create = { method: 'POST', pattern: collectionPattern }
    } else if (method === 'show') {
      routeDefs.show = { method: 'GET', pattern: memberPattern }
    } else if (method === 'edit') {
      routeDefs.edit = { method: 'GET', pattern: memberPattern.join('edit') }
    } else if (method === 'update') {
      routeDefs.update = { method: 'PUT', pattern: memberPattern }
    } else if (method === 'destroy') {
      routeDefs.destroy = { method: 'DELETE', pattern: memberPattern }
    }
  }

  return createRoutes(routeDefs) as any
}

export interface ResourcesOptions {
  only?: readonly ResourcesMethod[]
  param?: string
}

export type ResourcesRouteMap<
  B extends string,
  O extends ResourcesOptions,
> = BuildResourcesRouteMap<
  B,
  O extends { param: infer P extends string } ? P : 'id',
  O extends { only: infer Only extends readonly ResourcesMethod[] }
    ? Only
    : readonly ResourcesMethod[]
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
    // TODO: Use Join<Base, P> to get precise pattern types
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
