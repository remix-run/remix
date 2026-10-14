import { bench } from '@ark/attest'
import type { MatchParams } from '@remix-run/route-pattern/match'

bench.baseline(() => {
  type _ = MatchParams<'/:id'>
})

bench('grammar > large valid literal', () => {
  type _ = MatchParams<'/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/:id'>
}).types([9685, 'instantiations'])

bench('grammar > invalid literal', () => {
  type _ = MatchParams<'/:year-:month'>
}).types([745, 'instantiations'])

bench('grammar > graceful fallback', () => {
  type _ =
    MatchParams<'/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/:id'>
}).types([11592, 'instantiations'])
