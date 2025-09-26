import { RoutePattern } from '@remix-run/route-pattern'
import type { Params } from '@remix-run/route-pattern'

import { Route } from './router.ts'
import type { RequestHandler } from './router.ts'
import type { Simplify } from './type-utils.ts'

// Resources ///////////////////////////////////////////////////////////////////////////////////////

export class Resources<N extends string, const O extends ResourcesOptions> {
  readonly name: N
  readonly options: O
  readonly patterns: Simplify<ResourcesPatterns<N, O>>

  constructor(name: N, options?: O) {
    this.name = name
    this.options = options ?? ({} as O)

    let base = this.options.base ?? ''
    let param = this.options.param ?? 'id'
    let only = this.options.only ?? []

    let methodsToCreate: readonly ResourcesMethod[] = only.length > 0 ? [...only] : ResourcesMethods
    let patterns: Record<string, RoutePattern> = {}

    for (let method of methodsToCreate) {
      if (method === 'index') {
        patterns.index = new RoutePattern(`${base}/${name}`)
      } else if (method === 'new') {
        patterns.new = new RoutePattern(`${base}/${name}/new`)
      } else if (method === 'create') {
        patterns.create = new RoutePattern(`${base}/${name}`)
      } else if (method === 'show') {
        patterns.show = new RoutePattern(`${base}/${name}/:${param}`)
      } else if (method === 'edit') {
        patterns.edit = new RoutePattern(`${base}/${name}/:${param}/edit`)
      } else if (method === 'update') {
        patterns.update = new RoutePattern(`${base}/${name}/:${param}`)
      } else if (method === 'destroy') {
        patterns.destroy = new RoutePattern(`${base}/${name}/:${param}`)
      }
    }

    this.patterns = patterns as any
  }

  createRoutes(handlers: ResourcesHandlers<N, O>): ResourcesRoutes<N, O> {
    let patterns = this.patterns
    let routes: Route[] = []

    for (let method in patterns) {
      let pattern = (patterns as any)[method]
      let handler = (handlers as any)[method] as RequestHandler<Params<string>>

      if (method === 'index') {
        routes.push(new Route('GET', pattern, handler))
      } else if (method === 'new') {
        routes.push(new Route('GET', pattern, handler))
      } else if (method === 'create') {
        routes.push(new Route('POST', pattern, handler))
      } else if (method === 'show') {
        routes.push(new Route('GET', pattern, handler))
      } else if (method === 'edit') {
        routes.push(new Route('GET', pattern, handler))
      } else if (method === 'update') {
        routes.push(new Route('PUT', pattern, handler))
      } else if (method === 'destroy') {
        routes.push(new Route('DELETE', pattern, handler))
      }
    }

    return routes as any
  }
}

export function createResources<N extends string, const O extends ResourcesOptions>(
  name: N,
  options?: O,
): Resources<N, O> {
  return new Resources(name, options)
}

export interface ResourcesOptions {
  base?: string
  param?: string
  only?: readonly ResourcesMethod[]
}

// prettier-ignore
const ResourcesMethods: readonly ResourcesMethod[] = ['index', 'new', 'create', 'show', 'edit', 'update', 'destroy'] as const
type ResourcesMethod = 'index' | 'new' | 'create' | 'show' | 'edit' | 'update' | 'destroy'

type ResourcesPatterns<N extends string, O extends ResourcesOptions> = BuildResourcesPatterns<
  N,
  O extends { base: infer B extends string } ? B : '',
  O extends { param: infer P extends string } ? P : 'id',
  O extends { only: infer Only extends readonly ResourcesMethod[] } ? Only : typeof ResourcesMethods
>

// prettier-ignore
type BuildResourcesPatterns<
  N extends string,
  Base extends string,
  Param extends string,
  Methods extends readonly ResourcesMethod[],
> = {
  [
    K in ResourcesMethod as K extends Methods[number] ? K : never
  ]: (
    K extends 'index' ? RoutePattern<`${Base}/${N}`> :
    K extends 'new' ? RoutePattern<`${Base}/${N}/new`> :
    K extends 'create' ? RoutePattern<`${Base}/${N}`> :
    K extends 'show' ? RoutePattern<`${Base}/${N}/:${Param}`> :
    K extends 'edit' ? RoutePattern<`${Base}/${N}/:${Param}/edit`> :
    K extends 'update' ? RoutePattern<`${Base}/${N}/:${Param}`> :
    K extends 'destroy' ? RoutePattern<`${Base}/${N}/:${Param}`> :
    never
  )
}

type ResourcesHandlers<N extends string, O extends ResourcesOptions> = BuildResourcesHandlers<
  N,
  O extends { base: infer B extends string } ? B : '',
  O extends { param: infer P extends string } ? P : 'id',
  O extends { only: infer Only extends readonly ResourcesMethod[] } ? Only : typeof ResourcesMethods
>

// prettier-ignore
type BuildResourcesHandlers<
  N extends string,
  Base extends string,
  Param extends string,
  Methods extends readonly ResourcesMethod[],
> = {
  [
    K in ResourcesMethod as K extends Methods[number] ? K : never
  ]: (
    K extends 'index' ? RequestHandler<Params<`${Base}/${N}`>> :
    K extends 'new' ? RequestHandler<Params<`${Base}/${N}/new`>> :
    K extends 'create' ? RequestHandler<Params<`${Base}/${N}`>> :
    K extends 'show' ? RequestHandler<Params<`${Base}/${N}/:${Param}`>> :
    K extends 'edit' ? RequestHandler<Params<`${Base}/${N}/:${Param}/edit`>> :
    K extends 'update' ? RequestHandler<Params<`${Base}/${N}/:${Param}`>> :
    K extends 'destroy' ? RequestHandler<Params<`${Base}/${N}/:${Param}`>> :
    never
  )
}

type ResourcesRoutes<N extends string, O extends ResourcesOptions> = BuildResourcesRoutes<
  N,
  O extends { base: infer B extends string } ? B : '',
  O extends { param: infer P extends string } ? P : 'id',
  O extends { only: infer Only extends readonly ResourcesMethod[] } ? Only : typeof ResourcesMethods
>

// prettier-ignore
type BuildResourcesRoutes<
  N extends string,
  Base extends string,
  Param extends string,
  Methods extends readonly ResourcesMethod[],
> = [
  ...('index' extends Methods[number] ? [Route<'GET', `${Base}/${N}`>] : []),
  ...('new' extends Methods[number] ? [Route<'GET', `${Base}/${N}/new`>] : []),
  ...('create' extends Methods[number] ? [Route<'POST', `${Base}/${N}`>] : []),
  ...('show' extends Methods[number] ? [Route<'GET', `${Base}/${N}/:${Param}`>] : []),
  ...('edit' extends Methods[number] ? [Route<'GET', `${Base}/${N}/:${Param}/edit`>] : []),
  ...('update' extends Methods[number] ? [Route<'PUT', `${Base}/${N}/:${Param}`>] : []),
  ...('destroy' extends Methods[number] ? [Route<'DELETE', `${Base}/${N}/:${Param}`>] : []),
]

// Resource ////////////////////////////////////////////////////////////////////////////////////////

export class Resource<N extends string, const O extends ResourceOptions> {
  readonly name: N
  readonly options: O
  readonly patterns: Simplify<ResourcePatterns<N, O>>

  constructor(name: N, options?: O) {
    this.name = name
    this.options = options ?? ({} as O)

    let base = this.options.base ?? ''
    let only = this.options.only ?? []
    let methodsToCreate: readonly ResourceMethod[] = only.length > 0 ? [...only] : ResourceMethods
    let patterns: Record<string, RoutePattern> = {}

    for (let method of methodsToCreate) {
      if (method === 'new') {
        patterns.new = new RoutePattern(`${base}/${name}/new`)
      } else if (method === 'create') {
        patterns.create = new RoutePattern(`${base}/${name}`)
      } else if (method === 'show') {
        patterns.show = new RoutePattern(`${base}/${name}`)
      } else if (method === 'edit') {
        patterns.edit = new RoutePattern(`${base}/${name}/edit`)
      } else if (method === 'update') {
        patterns.update = new RoutePattern(`${base}/${name}`)
      } else if (method === 'destroy') {
        patterns.destroy = new RoutePattern(`${base}/${name}`)
      }
    }

    this.patterns = patterns as any
  }

  createRoutes(handlers: ResourceHandlers<N, O>): ResourceRoutes<N, O> {
    let patterns = this.patterns
    let routes: Route[] = []

    for (let method in patterns) {
      let pattern = (patterns as any)[method]
      let handler = (handlers as any)[method] as RequestHandler<Params<string>>

      if (method === 'new') {
        routes.push(new Route('GET', pattern, handler))
      } else if (method === 'create') {
        routes.push(new Route('POST', pattern, handler))
      } else if (method === 'show') {
        routes.push(new Route('GET', pattern, handler))
      } else if (method === 'edit') {
        routes.push(new Route('GET', pattern, handler))
      } else if (method === 'update') {
        routes.push(new Route('PUT', pattern, handler))
      } else if (method === 'destroy') {
        routes.push(new Route('DELETE', pattern, handler))
      }
    }

    return routes as any
  }
}

export function createResource<N extends string, const O extends ResourceOptions>(
  name: N,
  options?: O,
): Resource<N, O> {
  return new Resource(name, options)
}

export interface ResourceOptions {
  base?: string
  only?: readonly ResourceMethod[]
}

// prettier-ignore
const ResourceMethods: readonly ResourceMethod[] = ['new', 'create', 'show', 'edit', 'update', 'destroy'] as const
type ResourceMethod = 'new' | 'create' | 'show' | 'edit' | 'update' | 'destroy'

type ResourcePatterns<N extends string, O extends ResourceOptions> = BuildResourcePatterns<
  N,
  O extends { base: infer B extends string } ? B : '',
  O extends { only: infer Only extends readonly ResourceMethod[] } ? Only : typeof ResourceMethods
>

// prettier-ignore
type BuildResourcePatterns<
  N extends string,
  Base extends string,
  Methods extends readonly ResourceMethod[],
> = {
  [
    K in ResourceMethod as K extends Methods[number] ? K : never
  ]: (
    K extends 'new' ? RoutePattern<`${Base}/${N}/new`> :
    K extends 'create' ? RoutePattern<`${Base}/${N}`> :
    K extends 'show' ? RoutePattern<`${Base}/${N}`> :
    K extends 'edit' ? RoutePattern<`${Base}/${N}/edit`> :
    K extends 'update' ? RoutePattern<`${Base}/${N}`> :
    K extends 'destroy' ? RoutePattern<`${Base}/${N}`> :
    never
  )
}

type ResourceHandlers<N extends string, O extends ResourceOptions> = BuildResourceHandlers<
  N,
  O extends { base: infer B extends string } ? B : '',
  O extends { only: infer Only extends readonly ResourceMethod[] } ? Only : typeof ResourceMethods
>

// prettier-ignore
type BuildResourceHandlers<
  N extends string,
  Base extends string,
  Methods extends readonly ResourceMethod[],
> = {
  [
    K in ResourceMethod as K extends Methods[number] ? K : never
  ]: (
    K extends 'new' ? RequestHandler<Params<`${Base}/${N}/new`>> :
    K extends 'create' ? RequestHandler<Params<`${Base}/${N}`>> :
    K extends 'show' ? RequestHandler<Params<`${Base}/${N}`>> :
    K extends 'edit' ? RequestHandler<Params<`${Base}/${N}/edit`>> :
    K extends 'update' ? RequestHandler<Params<`${Base}/${N}`>> :
    K extends 'destroy' ? RequestHandler<Params<`${Base}/${N}`>> :
    never
  )
}

type ResourceRoutes<N extends string, O extends ResourceOptions> = BuildResourceRoutes<
  N,
  O extends { base: infer B extends string } ? B : '',
  O extends { only: infer Only extends readonly ResourceMethod[] } ? Only : typeof ResourceMethods
>

// prettier-ignore
type BuildResourceRoutes<
  N extends string,
  Base extends string,
  Methods extends readonly ResourceMethod[],
> = [
  ...('new' extends Methods[number] ? [Route<'GET', `${Base}/${N}/new`>] : []),
  ...('create' extends Methods[number] ? [Route<'POST', `${Base}/${N}`>] : []),
  ...('show' extends Methods[number] ? [Route<'GET', `${Base}/${N}`>] : []),
  ...('edit' extends Methods[number] ? [Route<'GET', `${Base}/${N}/edit`>] : []),
  ...('update' extends Methods[number] ? [Route<'PUT', `${Base}/${N}`>] : []),
  ...('destroy' extends Methods[number] ? [Route<'DELETE', `${Base}/${N}`>] : []),
]
