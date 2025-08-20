import { pluralize } from './pluralize.ts'
import type { Pluralize } from './pluralize.ts'
import { createRoute } from './route.ts'
import type { Route, RouteHandler, RouteOptions, RouteMethod } from './route.ts'

type CollectionPath<N extends string> = `/${Pluralize<N>}`
type MemberPath<N extends string, P extends string> = `/${Pluralize<N>}/:${P}`

type IndexPath<N extends string> = CollectionPath<N>
type NewPath<N extends string> = `${CollectionPath<N>}/new`
type CreatePath<N extends string> = CollectionPath<N>
type ShowPath<N extends string, P extends string> = MemberPath<N, P>
type EditPath<N extends string, P extends string> = `${MemberPath<N, P>}/edit`
type UpdatePath<N extends string, P extends string> = MemberPath<N, P>
type DestroyPath<N extends string, P extends string> = MemberPath<N, P>

// prettier-ignore
export type PathsFromOptions<O extends ResourceOptions<any, any>> =
  | ('index' extends keyof O ? IndexPath<O['name']> : never)
  | ('new' extends keyof O ? NewPath<O['name']> : never)
  | ('create' extends keyof O ? CreatePath<O['name']> : never)
  | ('show' extends keyof O ? ShowPath<O['name'], ParamFromOptions<O>> : never)
  | ('edit' extends keyof O ? EditPath<O['name'], ParamFromOptions<O>> : never)
  | ('update' extends keyof O ? UpdatePath<O['name'], ParamFromOptions<O>> : never)
  | ('destroy' extends keyof O ? DestroyPath<O['name'], ParamFromOptions<O>> : never)

// prettier-ignore
type ParamFromOptions<O extends ResourceOptions<any, any>> =
  [O['param']] extends [string] ? O['param'] : 'id'

type ResourceAlias = 'index' | 'new' | 'create' | 'show' | 'edit' | 'update' | 'destroy'

export interface ResourceOptions<N extends string, P extends string = 'id'> {
  name: N
  param?: P

  // aliases
  index?: RouteHandler<IndexPath<N>> | RouteOptions<'GET', IndexPath<N>>
  new?: RouteHandler<NewPath<N>> | RouteOptions<'GET', NewPath<N>>
  create?: RouteHandler<CreatePath<N>> | RouteOptions<'POST', CreatePath<N>>
  show?: RouteHandler<ShowPath<N, P>> | RouteOptions<'GET', ShowPath<N, P>>
  edit?: RouteHandler<EditPath<N, P>> | RouteOptions<'GET', EditPath<N, P>>
  update?: RouteHandler<UpdatePath<N, P>> | RouteOptions<'PATCH', UpdatePath<N, P>>
  destroy?: RouteHandler<DestroyPath<N, P>> | RouteOptions<'DELETE', DestroyPath<N, P>>
}

const aliasMethods = new Map<ResourceAlias, RouteMethod>([
  ['index', 'GET'],
  ['new', 'GET'],
  ['create', 'POST'],
  ['show', 'GET'],
  ['edit', 'GET'],
  ['update', 'PATCH'],
  ['destroy', 'DELETE'],
])

function createPatternForResource(name: string, param: string, alias: ResourceAlias): string {
  if (alias === 'index' || alias === 'create') return `/${pluralize(name)}`
  if (alias === 'new') return `/${pluralize(name)}/new`
  if (alias === 'edit') return `/${pluralize(name)}/:${param}/edit`
  // show, update, destroy all have the same pattern
  return `/${pluralize(name)}/:${param}`
}

export class Resource<O extends ResourceOptions<N, P>, N extends string, P extends string = 'id'> {
  readonly name: N
  readonly param: P
  readonly routes: Route<RouteMethod, PathsFromOptions<O>>[]

  // @ts-ignore - this.index is assigned conditionally in the constructor
  readonly index: 'index' extends keyof O ? Route<'GET', IndexPath<O['name']>> : undefined
  // @ts-ignore - this.new is assigned conditionally in the constructor
  readonly new: 'new' extends keyof O ? Route<'GET', NewPath<O['name']>> : undefined
  // @ts-ignore - this.create is assigned conditionally in the constructor
  readonly create: 'create' extends keyof O ? Route<'POST', CreatePath<O['name']>> : undefined
  // @ts-ignore - this.show is assigned conditionally in the constructor
  readonly show: 'show' extends keyof O
    ? Route<'GET', ShowPath<O['name'], ParamFromOptions<O>>>
    : undefined
  // @ts-ignore - this.edit is assigned conditionally in the constructor
  readonly edit: 'edit' extends keyof O
    ? Route<'GET', EditPath<O['name'], ParamFromOptions<O>>>
    : undefined
  // @ts-ignore - this.update is assigned conditionally in the constructor
  readonly update: 'update' extends keyof O
    ? Route<'PATCH', UpdatePath<O['name'], ParamFromOptions<O>>>
    : undefined
  // @ts-ignore - this.destroy is assigned conditionally in the constructor
  readonly destroy: 'destroy' extends keyof O
    ? Route<'DELETE', DestroyPath<O['name'], ParamFromOptions<O>>>
    : undefined

  constructor(options: O) {
    this.name = options.name
    this.param = (options.param ?? 'id') as any

    let routes: Route<any, any>[] = []
    for (let [key, method] of aliasMethods) {
      let handler = options[key]
      if (!handler) continue

      let route =
        typeof handler === 'function'
          ? createRoute({
              pattern: createPatternForResource(this.name, this.param, key),
              method,
              handler,
            })
          : createRoute(handler)

      routes.push(route)

      // Store the route in the resource instance as well so it can be accessed like
      // `resource.index` instead of `resource.routes[0]`
      this[key] = route as any
    }

    this.routes = routes as Route<RouteMethod, PathsFromOptions<O>>[]
  }
}

// ------

let user = new Resource({
  name: 'user',
  param: 'id',
  index: () => new Response('OK'),
  new: () => new Response('OK'),
})

type Options = typeof user extends Resource<infer O, any, any> ? O : never
type Patterns = PathsFromOptions<Options>

type X = typeof user.new
