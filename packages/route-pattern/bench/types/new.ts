import { bench } from '@ark/attest'
import { RoutePattern } from '@remix-run/route-pattern'

bench('new RoutePattern', () => {
  new RoutePattern('/posts/:id')
}).types([3, 'instantiations'])
