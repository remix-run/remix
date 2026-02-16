import { bench } from '@ark/attest'
import type { MatchGlob } from '../../src/lib/typed-glob/types.ts'

bench('typed-glob > extglob heavy', () => {
  verify<
    MatchGlob<
      'src/features/admin/routes/settings/index.tsx',
      'src/**/@(features|modules)/**/{routes,views}/**/index.@(ts|tsx)'
    >
  >()
}).types([8566, 'instantiations'])

bench('typed-glob > extglob nesting', () => {
  verify<
    MatchGlob<'repo/a/b/c/d/e/f/g/h/i/file.ts', 'repo/**/+(a|b|c|d|e|f|g|h|i)/**/file.@(ts|tsx)'>
  >()
}).types([5020, 'instantiations'])

function verify<value extends true>(): void {}
