import { bench } from '@ark/attest'
import { RoutePattern, type Join } from '@remix-run/route-pattern'

bench('join', () => {
  let pattern = new RoutePattern('/posts/:id')
  pattern.join('/comments/:commentId')
}).types([2704, 'instantiations'])

bench('Join', () => {
  type _ = Join<'/posts/:id', '/comments/:commentId'>
}).types([2628, 'instantiations'])
