import { createHrefBuilder as originalChb } from '@remix-run/route-pattern'
import type {
  HrefBuilderArgs,
  HrefBuilderOptions,
  RoutePattern,
  Variant,
} from '@remix-run/route-pattern'

import type { ExtractRoutePattern } from './route-patterns.ts'
import { isRouteStub } from './route-schema.ts'
import type { RouteDef, RouteStub } from './route-schema.ts'

export interface HrefBuilder<T extends RouteDef = string> {
  <P extends string extends T ? string : SourceOf<T> | Variant<SourceOf<T>>>(
    pattern: P | RoutePattern<P> | RouteStub<P>,
    ...args: HrefBuilderArgs<P>
  ): string
}

type SourceOf<T extends RouteDef> =
  ExtractRoutePattern<T> extends RoutePattern<infer S extends string> ? S : never

export function createHrefBuilder<T extends RouteDef>(
  options?: HrefBuilderOptions,
): HrefBuilder<ExtractRoutePattern<T>['source']> {
  let href = originalChb(options)

  return (input: any, ...args: any[]) => {
    return href(isRouteStub(input) ? input.pattern : input, ...(args as any))
  }
}
