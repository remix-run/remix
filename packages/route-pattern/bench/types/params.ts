import { bench } from '@ark/attest'
import { RoutePattern, type Params } from '@remix-run/route-pattern'

bench('params', () => {
  let pattern = new RoutePattern('/posts/:id')
  let match = pattern.match('https://example.com/posts/123')
  match?.params
}).types([1197, 'instantiations'])

bench('Params', () => {
  type _ = Params<'/posts/:id'>
}).types([1184, 'instantiations'])
