import { createHrefBuilder as originalChb } from '@remix-run/route-pattern'
import type { HrefBuilder, HrefBuilderOptions } from '@remix-run/route-pattern'

import { isRouteStub } from './route-schema.ts'
import type { RouteDef, ExtractRoutePattern } from './route-schema.ts'

export function createHrefBuilder<T extends RouteDef>(
  options?: HrefBuilderOptions,
): HrefBuilder<ExtractRoutePattern<T>> {
  let href = originalChb(options)

  return (input: any, ...args: any[]) => {
    return href(isRouteStub(input) ? input.pattern : input, ...(args as any))
  }
}
