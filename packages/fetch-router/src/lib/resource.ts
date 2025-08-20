import { pluralize } from './pluralize.ts'
import type { Pluralize } from './pluralize.ts'
import { createRoute } from './route.ts'
import type { Route, RouteHandler, RouteMethod } from './route.ts'

export interface ResourceOptions {
  name: string
  param?: string
}

type ResourceName<O extends ResourceOptions> = O['name']
type ParamName<O extends ResourceOptions> = [O['param']] extends [string] ? O['param'] : 'id'

type CollectionPath<N extends string> = `/${Pluralize<N>}`
type MemberPath<N extends string, P extends string> = `/${Pluralize<N>}/:${P}`

type IndexPath<O extends ResourceOptions> = CollectionPath<ResourceName<O>>
type NewPath<O extends ResourceOptions> = `${CollectionPath<ResourceName<O>>}/new`
type CreatePath<O extends ResourceOptions> = CollectionPath<ResourceName<O>>
type ShowPath<O extends ResourceOptions> = MemberPath<ResourceName<O>, ParamName<O>>
type EditPath<O extends ResourceOptions> = `${MemberPath<ResourceName<O>, ParamName<O>>}/edit`
type UpdatePath<O extends ResourceOptions> = MemberPath<ResourceName<O>, ParamName<O>>
type DestroyPath<O extends ResourceOptions> = MemberPath<ResourceName<O>, ParamName<O>>

export interface ResourceMethods<O extends ResourceOptions> {
  index: RouteHandler<IndexPath<O>>
  new: RouteHandler<NewPath<O>>
  create: RouteHandler<CreatePath<O>>
  show: RouteHandler<ShowPath<O>>
  edit: RouteHandler<EditPath<O>>
  update: RouteHandler<UpdatePath<O>>
  destroy: RouteHandler<DestroyPath<O>>
}

type ResourceMethod = keyof ResourceMethods<any>

export interface Resource<O extends ResourceOptions> {
  type: 'resource'
  options: O
  // TODO: get specific route patterns from options? then pulling route patterns
  // for a resource would be easier
  routes: Route<string>[]
}

export function createResource<const O extends ResourceOptions, const M extends ResourceMethods<O>>(
  options: O & Partial<M>,
): Resource<O> {
  let routes: Route<string>[] = []
  for (let method of resourceMethods) {
    let handler = options[method]
    if (!handler) continue
    routes.push(
      createRoute({
        pattern: createPatternForResource(options.name, options.param ?? 'id', method),
        method: resourceMethodVerbs.get(method)!,
        handler: handler as RouteHandler<string>,
      }),
    )
  }

  return { type: 'resource', options, routes }
}

const resourceMethodVerbs = new Map<ResourceMethod, RouteMethod>([
  ['index', 'GET'],
  ['new', 'GET'],
  ['create', 'POST'],
  ['show', 'GET'],
  ['edit', 'GET'],
  ['update', 'PATCH'],
  ['destroy', 'DELETE'],
])

const resourceMethods = Array.from(resourceMethodVerbs.keys()) as ResourceMethod[]

function createPatternForResource(name: string, param: string, method: ResourceMethod): string {
  let plural = pluralize(name)

  if (method === 'index') return `/${plural}`
  if (method === 'new') return `/${plural}/new`
  if (method === 'create') return `/${plural}`
  if (method === 'show') return `/${plural}/:${param}`
  if (method === 'edit') return `/${plural}/:${param}/edit`
  if (method === 'update') return `/${plural}/:${param}`
  if (method === 'destroy') return `/${plural}/:${param}`

  method satisfies never

  throw new Error(`Invalid route method: ${method}`)
}

// prettier-ignore
export type PatternsForResource<R> =
  R extends Resource<infer O extends ResourceOptions> ? (
    | (O extends { index: any } ? IndexPath<O> : never)
    | (O extends { new: any } ? NewPath<O> : never)
    | (O extends { create: any } ? CreatePath<O> : never)
    | (O extends { show: any } ? ShowPath<O> : never)
    | (O extends { edit: any } ? EditPath<O> : never)
    | (O extends { update: any } ? UpdatePath<O> : never)
    | (O extends { destroy: any } ? DestroyPath<O> : never)
  ) :
  never
