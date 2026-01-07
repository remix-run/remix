import type { AST } from './ast.ts'
import { split } from './split.ts'
import * as Parse from './parse.ts'
import { PartPattern } from '../part-pattern.ts'

export class RoutePattern {
  readonly ast: AST

  private constructor(ast: AST) {
    this.ast = ast
  }

  static parse(source: string): RoutePattern {
    let spans = split(source)

    return new RoutePattern({
      protocol: spans.protocol
        ? PartPattern.parse(source, spans.protocol)
        : PartPattern.parse('*', [0, 1]),
      hostname: spans.hostname
        ? PartPattern.parse(source, spans.hostname)
        : PartPattern.parse('*', [0, 1]),
      port: spans.port ? source.slice(...spans.port) : null,
      pathname: spans.pathname
        ? PartPattern.parse(source, spans.pathname)
        : PartPattern.parse('', [0, 0]),
      search: spans.search ? Parse.search(source.slice(...spans.search)) : new Map(),
    })
  }
}
