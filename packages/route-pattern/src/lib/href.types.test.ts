import type { HrefBuilder } from './href.ts'
import type { RoutePattern } from './route-pattern.ts'
import type { Assert, IsEqual } from './type-utils.d.ts'

// prettier-ignore
export type Tests = [
  // First arg type with string generic
  Assert<IsEqual<
    Parameters<HrefBuilder<'/products(/:id)'>>[0],
    '/products(/:id)' | '/products' | '/products/:id'
  >>,

  // First arg type when generic is derived from RoutePattern
  Assert<IsEqual<
    Parameters<HrefBuilder<RoutePattern<'/products(/:id)'>>>[0],
    '/products(/:id)' | '/products' | '/products/:id'
  >>,
]
