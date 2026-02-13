import type { Assert, IsEqual } from './type-test-utils.ts'
import type { globParityCases } from './parity-cases.ts'
import type { GlobMatchOptions, MatchGlob } from './types.ts'

type CaseMatchesExpectation<
  testCase extends {
    path: string
    pattern: string
    options?: GlobMatchOptions
    expected: boolean
  },
> = IsEqual<
  MatchGlob<
    testCase['path'],
    testCase['pattern'],
    testCase extends { options: infer options extends GlobMatchOptions } ? options : {}
  >,
  testCase['expected']
>

type CaseResultUnion<
  testCase extends {
    path: string
    pattern: string
    options?: GlobMatchOptions
    expected: boolean
  },
> = testCase extends testCase ? CaseMatchesExpectation<testCase> : never

type AllParityCasesMatch =
  Exclude<CaseResultUnion<(typeof globParityCases)[number]>, true> extends never ? true : false

export type ParityCaseTests = Assert<AllParityCasesMatch>
