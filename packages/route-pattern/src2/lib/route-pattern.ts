import type { RoutePatternAST } from './ast.ts'
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

export class RoutePattern<source extends string = string> {
  readonly ast: RoutePatternAST

  readonly protocol: string
  readonly hostname: string
  readonly port: string
  readonly pathname: string
  readonly search: string

  #matcher: RoutePatternMatcher<undefined>

  constructor(ast: RoutePatternAST) {
    this.ast = ast

    this.protocol = serializeProtocol(this.ast)
    this.hostname = serializeHostname(this.ast)
    this.port = this.ast.port ?? ''
    this.pathname = serializePathname(this.ast)
    this.search = serializeSearch(this.ast)

    this.#matcher = createPatternMatcher()
    this.#matcher.add(this.ast, undefined)
  }

  static parse(source: string): RoutePattern {
    return new RoutePattern(parsePattern(source))
  }

  join<other extends string>(
    other: other | RoutePattern<other>,
  ): RoutePattern<Join<source, other>> {
    let otherAst = typeof other === 'string' ? parsePattern(other) : other.ast
    return new RoutePattern(joinPatterns(this.ast, otherAst))
  }

  href(...args: HrefArgs<source>): string {
    return toHref(this.ast, ...(args as any))
  }

  match(url: string | URL): RoutePatternMatch<undefined> | null {
    return this.#matcher.match(url)
  }

  test(url: string | URL): boolean {
    return this.match(url) !== null
  }
}
