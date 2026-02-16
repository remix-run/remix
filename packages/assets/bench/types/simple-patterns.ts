import { bench } from '@ark/attest'
import type { MatchGlob } from '../../src/lib/typed-glob/types.ts'

bench('typed-glob > simple app recursive wildcard', () => {
  verify<MatchGlob<'app/images/books/cover.png', 'app/images/**/*.*'>>()
}).types([780, 'instantiations'])

bench('typed-glob > simple extension set (brace list)', () => {
  verify<MatchGlob<'assets/images/photo.jpeg', 'assets/**/*.{jpg,jpeg,png,gif}'>>()
}).types([1076, 'instantiations'])

bench('typed-glob > simple allow app subtree', () => {
  verify<MatchGlob<'app/routes/home.tsx', 'app/**'>>()
}).types([498, 'instantiations'])

bench('typed-glob > simple deny env files', () => {
  verify<MatchGlob<'app/.env.local', '**/.env*'>>()
}).types([599, 'instantiations'])

bench('typed-glob > advanced extglob (comparison)', () => {
  verify<
    MatchGlob<
      'src/features/admin/routes/settings/index.tsx',
      'src/**/@(features|modules)/**/index.@(ts|tsx)'
    >
  >()
}).types([4961, 'instantiations'])

bench('typed-glob > advanced class (comparison)', () => {
  verify<MatchGlob<'app/logo5.png', 'app/logo[0-9].png'>>()
}).types([2808, 'instantiations'])

function verify<value extends true>(): void {}
