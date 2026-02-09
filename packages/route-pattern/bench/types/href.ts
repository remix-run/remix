import { bench } from '@ark/attest'
import { RoutePattern, type HrefArgs } from '@remix-run/route-pattern'

bench('href', () => {
  let pattern = new RoutePattern('/posts/:id')
  pattern.href({ id: '123' })
}).types([1344, 'instantiations'])

bench('HrefArgs', () => {
  type _ = HrefArgs<'/posts/:id'>
}).types([1059, 'instantiations'])
