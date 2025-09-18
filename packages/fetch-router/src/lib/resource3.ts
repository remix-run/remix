import type { Route, RouteHandler } from './route.ts'

// prettier-ignore
type ResourcePath<N extends string, M extends string> =
  M extends 'new' ? `/${N}/new` :
  M extends 'edit' ? `/${N}/edit` :
  `/${N}/${M}`

// prettier-ignore
type ResourcesPath<N extends string, P extends string, M extends string> =
  M extends 'index' ? `/${N}` :
  M extends 'new' ? `/${N}/new` :
  M extends 'create' ? `/${N}` :
  M extends 'show' ? `/${N}/:${P}` :
  M extends 'edit' ? `/${N}/:${P}/edit` :
  M extends 'update' ? `/${N}/:${P}` :
  M extends 'destroy' ? `/${N}/:${P}` :
  `/${N}/${M}`

export interface ResourceOptions {
  name: string
  param?: string
}

export type ResourceFromOptions<
  O extends ResourceOptions,
  H extends Record<string, any> = {},
> = ResourceRoutes<O['name'], O['param'] extends string ? O['param'] : 'id', H>

// Define canonical order for resource aliases
type ResourcesMethods = ['index', 'new', 'create', 'show', 'edit', 'update', 'destroy']

// Helper to get route type for a specific method
// prettier-ignore
type RouteForMethod<Method extends string, Name extends string, Param extends string> =
  Method extends 'index' ? Route<'GET', IndexPath<Name>> :
  Method extends 'new' ? Route<'GET', NewPath<Name>> :
  Method extends 'create' ? Route<'POST', CreatePath<Name>> :
  Method extends 'show' ? Route<'GET', ShowPath<Name, Param>> :
  Method extends 'edit' ? Route<'GET', EditPath<Name, Param>> :
  Method extends 'update' ? Route<'PATCH', UpdatePath<Name, Param>> :
  Method extends 'destroy' ? Route<'DELETE', DestroyPath<Name, Param>> :
  never

// Helper to build routes tuple recursively
type ResourceRoutes<
  Name extends string,
  Param extends string,
  Handlers extends Record<string, any>,
  Methods extends string[] = ResourcesMethods,
  Acc extends any[] = [],
> = Methods extends [infer Head extends string, ...infer Tail extends string[]]
  ? Head extends keyof Handlers
    ? ResourceRoutes<Name, Param, Handlers, Tail, [...Acc, RouteForMethod<Head, Name, Param>]>
    : ResourceRoutes<Name, Param, Handlers, Tail, Acc>
  : Acc

type X = ResourceRoutes<
  'user',
  'id',
  {
    new: RouteHandler<NewPath<'user'>>
    index: RouteHandler<IndexPath<'user'>>
    collection: {
      revise: RouteHandler<'/users/revise'>
    }
    member: {
      hide: RouteHandler<'/users/:id/hide'>
    }
  }
>

export function createResource<
  N extends string,
  P extends string,
  H extends Record<string, RouteHandler>,
>(name: N, param: P, handlers: H): ResourceRoutes<N, P, H> {
  // TODO: Implementation
  return [] as any
}
