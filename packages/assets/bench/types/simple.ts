import { bench } from '@ark/attest'
import type { MatchGlob } from '../../src/lib/typed-glob/types.ts'

bench.baseline(() => {
  verify<MatchGlob<'app/entry.ts', 'app/entry.ts'>>()
})

bench('typed-glob > simple match', () => {
  verify<MatchGlob<'app/routes/index.tsx', 'app/routes/*.tsx'>>()
}).types([184, 'instantiations'])

bench('typed-glob > simple no match', () => {
  verify<MatchGlob<'app/routes/index.js', 'app/routes/*.tsx'> extends false ? true : false>()
}).types([182, 'instantiations'])

function verify<value extends true>(): void {}
