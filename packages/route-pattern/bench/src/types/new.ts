import { bench } from '@ark/attest'
import { RoutePattern } from '@remix-run/route-pattern'

bench.baseline(() => {
  RoutePattern.parse('')
})

bench('new > simple route', () => {
  let pattern = RoutePattern.parse('/posts/:id')
  pattern.toString()
}).types([3, 'instantiations'])

bench('new > complex route', () => {
  let pattern = RoutePattern.parse('/api(/v:major(.:minor))/*path/help')
  pattern.toString()
}).types([3, 'instantiations'])

bench('new > mediarss', async () => {
  let { patterns } = await import('../../patterns/mediarss.ts')
  eagerlyEvaluateTypesForNew(patterns)
}).types([2648, 'instantiations'])

bench('new > shopify', async () => {
  let { patterns } = await import('../../patterns/shopify.ts')
  eagerlyEvaluateTypesForNew(patterns)
}).types([12609, 'instantiations'])

/** Type-only utility to force eager evaluation of href param types */
function eagerlyEvaluateTypesForNew<patterns extends ReadonlyArray<string>>(
  // oxfmt-ignore
  _: patterns & (
    { [pattern in patterns[number]]: RoutePattern<pattern> } extends
    { [pattern in patterns[number]]: RoutePattern<string> }
    ? patterns : never
  ),
): void {}
