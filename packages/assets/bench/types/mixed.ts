import { bench } from '@ark/attest'
import type { MatchGlob } from '../../src/lib/typed-glob/types.ts'

bench('typed-glob > mixed stress case', () => {
  verify<
    MatchGlob<
      'packages/core/src/features/admin/routes/settings/page.tsx',
      '**/{src,lib,app}/**/@(features|modules)/**/{routes,views}/**/page.@(ts|tsx|mts|cts)',
      { dot: true; nocase: true; matchBase: false }
    >
  >()
}).types([19869, 'instantiations'])

bench('typed-glob > long globstar chain', () => {
  verify<
    MatchGlob<
      'repo/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/index.ts',
      'repo/**/a/**/b/**/c/**/d/**/e/**/f/**/g/**/h/**/i/**/j/**/k/**/l/**/m/**/n/**/o/**/p/**/index.@(ts|tsx)'
    >
  >()
}).types([7701, 'instantiations'])

function verify<value extends true>(): void {}
