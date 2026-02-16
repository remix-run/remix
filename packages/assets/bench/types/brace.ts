import { bench } from '@ark/attest'
import type { MatchGlob } from '../../src/lib/typed-glob/types.ts'

bench('typed-glob > brace heavy', () => {
  verify<
    MatchGlob<
      'app/routes/admin/settings.page.ts',
      'app/routes/{index,about,docs,blog,admin,account}/@(index|settings.page).{ts,tsx,js,jsx}'
    >
  >()
}).types([25989, 'instantiations'])

bench('typed-glob > brace and options', () => {
  verify<
    MatchGlob<
      'SRC/.CONFIG/ENV.PROD.TS',
      '**/.@(config|CONFIG)/**/env.@(prod|dev).@(ts|js)',
      { nocase: true; dot: true }
    >
  >()
}).types([4492, 'instantiations'])

function verify<value extends true>(): void {}
