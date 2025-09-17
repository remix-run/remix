// prettier-ignore
type ResolvePattern<S extends string, B extends string> = `${B}${S}`

class _RoutePattern<T extends string> {
  readonly source: T

  constructor(source: string, base: string | { source: string } = '') {
    if (typeof base !== 'string') base = base.source
    this.source = (base + source) as T
  }
}

interface RoutePatternConstructor {
  new <S extends string>(source: S): RoutePattern<ResolvePattern<S, ''>>
  new <S extends string, B extends string>(source: S, base: B): RoutePattern<ResolvePattern<S, B>>
  new <S extends string, B extends string>(
    source: S,
    base: RoutePattern<B>,
  ): RoutePattern<ResolvePattern<S, B>>
}

export type RoutePattern<T extends string> = _RoutePattern<T>
export const RoutePattern: RoutePatternConstructor =
  _RoutePattern as unknown as RoutePatternConstructor

let pattern = new RoutePattern('users/:id', 'https://example.com/api')
