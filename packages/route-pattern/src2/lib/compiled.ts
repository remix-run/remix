import type { RoutePattern } from './route-pattern.ts'
import { parsePattern } from './parse.ts'
import {
  serializeProtocol,
  serializeHostname,
  serializePathname,
  serializeSearch,
} from './serialize.ts'
import { joinPatterns } from './join.ts'
import type { Join } from './types/join.ts'
import type { HrefArgs } from './href.ts'
import { toHref } from './href.ts'
import type { RoutePatternMatch } from './matcher.ts'
import type { RoutePatternMatcher } from './matcher.ts'
import { createPatternMatcher } from './matcher.ts'

export class CompiledRoutePattern<source extends string = string> {
  readonly pattern: RoutePattern<source>

  readonly protocol: string
  readonly hostname: string
  readonly port: string
  readonly pathname: string
  readonly search: string

  #matcher: RoutePatternMatcher<undefined>

  constructor(pattern: RoutePattern<source>) {
    this.pattern = pattern

    this.protocol = serializeProtocol(this.pattern)
    this.hostname = serializeHostname(this.pattern)
    this.port = this.pattern.port ?? ''
    this.pathname = serializePathname(this.pattern)
    this.search = serializeSearch(this.pattern)

    this.#matcher = createPatternMatcher()
    this.#matcher.add(this.pattern, undefined)
  }

  static parse<source extends string>(source: source): CompiledRoutePattern<source> {
    return new CompiledRoutePattern(parsePattern(source))
  }

  join<other extends string>(
    other: other | CompiledRoutePattern<other>,
  ): CompiledRoutePattern<Join<source, other>> {
    let otherPattern = typeof other === 'string' ? parsePattern(other) : other.pattern
    return new CompiledRoutePattern(joinPatterns(this.pattern, otherPattern))
  }

  href(...args: HrefArgs<source>): string {
    return toHref(this.pattern, ...(args as any))
  }

  match(url: string | URL): RoutePatternMatch<source, undefined> | null {
    return this.#matcher.match(url) as RoutePatternMatch<source, undefined> | null
  }

  test(url: string | URL): boolean {
    return this.match(url) !== null
  }
}
