import assert from 'node:assert/strict'
import { test } from 'node:test'
import { minimatch } from 'minimatch'
import type { IsEqual } from './test-utils.ts'
import type { GlobMatchOptions, MatchGlob, MatchGlobAdvanced } from './types.ts'

type ParityCase = {
  path: string
  pattern: string
  options: GlobMatchOptions
  expected: boolean
}

type PublicMatchResult<testCase extends ParityCase> = MatchGlob<
  testCase['path'],
  testCase['pattern'],
  testCase['options']
>

type AdvancedMatchResult<testCase extends ParityCase> = MatchGlobAdvanced<
  testCase['path'],
  testCase['pattern'],
  testCase['options']
>

type PublicParityFailureForCase<testCase extends ParityCase> =
  IsEqual<PublicMatchResult<testCase>, testCase['expected']> extends true
    ? never
    : {
        mode: 'public'
        path: testCase['path']
        pattern: testCase['pattern']
        options: testCase['options']
        expected: testCase['expected']
        actual: PublicMatchResult<testCase>
      }

type AdvancedParityFailureForCase<testCase extends ParityCase> =
  IsEqual<AdvancedMatchResult<testCase>, testCase['expected']> extends true
    ? never
    : {
        mode: 'advanced'
        path: testCase['path']
        pattern: testCase['pattern']
        options: testCase['options']
        expected: testCase['expected']
        actual: AdvancedMatchResult<testCase>
      }

type AdvancedMirrorsPublicFailureForCase<testCase extends ParityCase> =
  IsEqual<AdvancedMatchResult<testCase>, PublicMatchResult<testCase>> extends true
    ? never
    : {
        mode: 'advanced-mirrors-public'
        path: testCase['path']
        pattern: testCase['pattern']
        options: testCase['options']
        public: PublicMatchResult<testCase>
        advanced: AdvancedMatchResult<testCase>
      }

type AssertTypeFailures<testCase extends ParityCase> =
  | PublicParityFailureForCase<testCase>
  | AdvancedParityFailureForCase<testCase>
  | AdvancedMirrorsPublicFailureForCase<testCase>

type AssertTypes<testCase extends ParityCase> = [AssertTypeFailures<testCase>] extends [never]
  ? true
  : {
      parity_failures: AssertTypeFailures<testCase>
    }

type AssertIsTrue<value extends true> = value

test.describe('typed-glob: minimatch parity', () => {
  test('literal exact', () => {
    let parityCase = {
      path: 'abc',
      pattern: 'abc',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('literal mismatch', () => {
    let parityCase = {
      path: 'abc',
      pattern: 'abd',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('star matches segment', () => {
    let parityCase = {
      path: 'abc',
      pattern: '*',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('star does not cross slash', () => {
    let parityCase = {
      path: 'abc/def',
      pattern: '*',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('star suffix', () => {
    let parityCase = {
      path: 'abc',
      pattern: 'a*',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('star suffix does not cross slash', () => {
    let parityCase = {
      path: 'ab/c',
      pattern: 'a*',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('question mark matches single char', () => {
    let parityCase = {
      path: 'ab',
      pattern: 'a?',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('question mark requires one char', () => {
    let parityCase = {
      path: 'a',
      pattern: 'a?',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('question mark does not cross slash', () => {
    let parityCase = {
      path: 'ab/c',
      pattern: 'a?',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('globstar recursive', () => {
    let parityCase = {
      path: 'a/b/d/c',
      pattern: 'a/**/c',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('globstar zero segments', () => {
    let parityCase = {
      path: 'a/c',
      pattern: 'a/**/c',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('globstar mismatch', () => {
    let parityCase = {
      path: 'a/b/d',
      pattern: 'a/**/c',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('collapsed stars', () => {
    let parityCase = {
      path: 'abc',
      pattern: 'a***c',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('collapsed stars with question', () => {
    let parityCase = {
      path: 'abc',
      pattern: 'a*****?c',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('double globstar path match', () => {
    let parityCase = {
      path: 'a/b',
      pattern: '**',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('double globstar dot segment default', () => {
    let parityCase = {
      path: 'a/.d',
      pattern: '**',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('double globstar dot segment with dot option', () => {
    let parityCase = {
      path: 'a/.d',
      pattern: '**',
      options: { dot: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('escaped star literal', () => {
    let parityCase = {
      path: '*',
      pattern: '\\*',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('escaped question literal', () => {
    let parityCase = {
      path: '?',
      pattern: '\\?',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('escaped left bracket literal', () => {
    let parityCase = {
      path: '[',
      pattern: '[[]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('escaped backslash in class', () => {
    let parityCase = {
      path: '\\',
      pattern: '[\\\\]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('escaped star in text', () => {
    let parityCase = {
      path: 'a*b',
      pattern: 'a\\*b',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('escaped question in text', () => {
    let parityCase = {
      path: 'a?b',
      pattern: 'a\\?b',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('brace set match', () => {
    let parityCase = {
      path: 'app/logo.png',
      pattern: '**/*.{png,jpg,jpeg}',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('brace set miss', () => {
    let parityCase = {
      path: 'app/logo.gif',
      pattern: '**/*.{png,jpg,jpeg}',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('brace alternatives include globstar', () => {
    let parityCase = {
      path: 'x/c',
      pattern: '{a,b,**}/c',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('brace alternatives miss', () => {
    let parityCase = {
      path: 'x/c',
      pattern: '{a,b}/c',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('brace alternatives direct match', () => {
    let parityCase = {
      path: 'b/file.ts',
      pattern: '{a,b}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range ascending', () => {
    let parityCase = {
      path: '2/file.ts',
      pattern: '{1..3}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range descending', () => {
    let parityCase = {
      path: '2/file.ts',
      pattern: '{3..1}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range ascending low bound', () => {
    let parityCase = {
      path: '1/file.ts',
      pattern: '{1..3}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range ascending high bound', () => {
    let parityCase = {
      path: '3/file.ts',
      pattern: '{1..3}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range below bound miss', () => {
    let parityCase = {
      path: '0/file.ts',
      pattern: '{1..3}/file.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range miss', () => {
    let parityCase = {
      path: '9/file.ts',
      pattern: '{1..3}/file.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range descending low bound', () => {
    let parityCase = {
      path: '1/file.ts',
      pattern: '{3..1}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range descending high bound', () => {
    let parityCase = {
      path: '3/file.ts',
      pattern: '{3..1}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range descending miss', () => {
    let parityCase = {
      path: '4/file.ts',
      pattern: '{3..1}/file.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range singleton match', () => {
    let parityCase = {
      path: '5/file.ts',
      pattern: '{5..5}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('numeric range singleton miss', () => {
    let parityCase = {
      path: '4/file.ts',
      pattern: '{5..5}/file.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range ascending', () => {
    let parityCase = {
      path: 'b/file.ts',
      pattern: '{a..c}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range descending', () => {
    let parityCase = {
      path: 'b/file.ts',
      pattern: '{c..a}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range ascending low bound', () => {
    let parityCase = {
      path: 'a/file.ts',
      pattern: '{a..c}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range ascending high bound', () => {
    let parityCase = {
      path: 'c/file.ts',
      pattern: '{a..c}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range ascending miss', () => {
    let parityCase = {
      path: 'd/file.ts',
      pattern: '{a..c}/file.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range descending low bound', () => {
    let parityCase = {
      path: 'a/file.ts',
      pattern: '{c..a}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range descending high bound', () => {
    let parityCase = {
      path: 'c/file.ts',
      pattern: '{c..a}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range singleton match', () => {
    let parityCase = {
      path: 'z/file.ts',
      pattern: '{z..z}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range singleton miss', () => {
    let parityCase = {
      path: 'y/file.ts',
      pattern: '{z..z}/file.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range miss', () => {
    let parityCase = {
      path: 'z/file.ts',
      pattern: '{a..c}/file.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('inline numeric range match', () => {
    let parityCase = {
      path: 'v2.ts',
      pattern: 'v{1..3}.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('inline numeric range miss', () => {
    let parityCase = {
      path: 'v4.ts',
      pattern: 'v{1..3}.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('mixed brace range and literal match', () => {
    let parityCase = {
      path: 'v8.ts',
      pattern: 'v{1..3,8}.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('mixed brace range and literal miss', () => {
    let parityCase = {
      path: 'v9.ts',
      pattern: 'v{1..3,8}.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('brace set path segment match', () => {
    let parityCase = {
      path: 'x/a/c',
      pattern: 'x/{a,b}/c',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('brace set path segment miss', () => {
    let parityCase = {
      path: 'x/d/c',
      pattern: 'x/{a,b}/c',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nobrace range-like pattern is literal', () => {
    let parityCase = {
      path: 'v2.ts',
      pattern: 'v{1..3}.ts',
      options: { nobrace: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nobrace range-like literal text match', () => {
    let parityCase = {
      path: 'v{1..3}.ts',
      pattern: 'v{1..3}.ts',
      options: { nobrace: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nobrace keeps braces literal', () => {
    let parityCase = {
      path: 'x.ts',
      pattern: 'x.{ts,js}',
      options: { nobrace: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nobrace literal with braces', () => {
    let parityCase = {
      path: 'x.{ts,js}',
      pattern: 'x.{ts,js}',
      options: { nobrace: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob with brace alternative one', () => {
    let parityCase = {
      path: 'ab',
      pattern: '*(a|{b,c})',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob with brace alternative two', () => {
    let parityCase = {
      path: 'ac',
      pattern: '*(a|{b,c})',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('digit class match', () => {
    let parityCase = {
      path: 'app/logo5.png',
      pattern: 'app/logo[0-9].png',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('digit class miss', () => {
    let parityCase = {
      path: 'app/logoa.png',
      pattern: 'app/logo[0-9].png',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('negated class match', () => {
    let parityCase = {
      path: 'app/logoa.png',
      pattern: 'app/logo[!0-9].png',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('negated class miss', () => {
    let parityCase = {
      path: 'app/logo5.png',
      pattern: 'app/logo[!0-9].png',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('right bracket literal class', () => {
    let parityCase = {
      path: ']',
      pattern: '[]]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range class match', () => {
    let parityCase = {
      path: 'p',
      pattern: '[a-z]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('alpha range class miss', () => {
    let parityCase = {
      path: 'A',
      pattern: '[a-z]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('subrange class match', () => {
    let parityCase = {
      path: 'm',
      pattern: '[m-z]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('subrange class miss', () => {
    let parityCase = {
      path: 'l',
      pattern: '[m-z]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('negated alpha class match', () => {
    let parityCase = {
      path: 'a',
      pattern: '[!b-z]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('negated alpha class miss', () => {
    let parityCase = {
      path: 'm',
      pattern: '[!b-z]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple digit class', () => {
    let parityCase = {
      path: '5',
      pattern: '[0-9]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple digit class miss', () => {
    let parityCase = {
      path: 'x',
      pattern: '[0-9]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix digit match', () => {
    let parityCase = {
      path: '5',
      pattern: '[[:digit:]]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix digit miss', () => {
    let parityCase = {
      path: 'x',
      pattern: '[[:digit:]]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix alpha match', () => {
    let parityCase = {
      path: 'a',
      pattern: '[[:alpha:]]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix alpha miss', () => {
    let parityCase = {
      path: '5',
      pattern: '[[:alpha:]]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix xdigit match', () => {
    let parityCase = {
      path: 'f',
      pattern: '[[:xdigit:]]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix xdigit miss', () => {
    let parityCase = {
      path: 'G',
      pattern: '[[:xdigit:]]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix upper match', () => {
    let parityCase = {
      path: 'A',
      pattern: '[[:upper:]]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix upper miss', () => {
    let parityCase = {
      path: 'a',
      pattern: '[[:upper:]]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix lower match', () => {
    let parityCase = {
      path: 'a',
      pattern: '[[:lower:]]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix lower miss', () => {
    let parityCase = {
      path: 'A',
      pattern: '[[:lower:]]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix space match', () => {
    let parityCase = {
      path: ' ',
      pattern: '[[:space:]]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix space miss', () => {
    let parityCase = {
      path: 'x',
      pattern: '[[:space:]]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix word match', () => {
    let parityCase = {
      path: '_',
      pattern: '[[:word:]]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('posix word miss', () => {
    let parityCase = {
      path: '-',
      pattern: '[[:word:]]',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob any-of match', () => {
    let parityCase = {
      path: 'app/main.ts',
      pattern: 'app/*.@(ts|tsx)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob any-of miss', () => {
    let parityCase = {
      path: 'app/main.js',
      pattern: 'app/*.@(ts|tsx)',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob any-of second arm', () => {
    let parityCase = {
      path: 'app/main.tsx',
      pattern: 'app/*.@(ts|tsx)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob any-of miss close suffix', () => {
    let parityCase = {
      path: 'app/main.tsxx',
      pattern: 'app/*.@(ts|tsx)',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob negate miss', () => {
    let parityCase = {
      path: 'foo.js',
      pattern: '*.!(js)',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob negate match', () => {
    let parityCase = {
      path: 'foo.ts',
      pattern: '*.!(js)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob negate match non-js extension', () => {
    let parityCase = {
      path: 'foo.bar',
      pattern: '*.!(js)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob at with suffix match', () => {
    let parityCase = {
      path: 'fool',
      pattern: '@(foo)*',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob at exact match', () => {
    let parityCase = {
      path: 'foo',
      pattern: '@(foo)*',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob at mismatch', () => {
    let parityCase = {
      path: 'bar',
      pattern: '@(foo)*',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob optional miss', () => {
    let parityCase = {
      path: 'app/main.css',
      pattern: 'app/*.?(map|ts)',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob optional map', () => {
    let parityCase = {
      path: 'app/main.map',
      pattern: 'app/*.?(map|ts)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob optional ts', () => {
    let parityCase = {
      path: 'app/main.ts',
      pattern: 'app/*.?(map|ts)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob one-or-more', () => {
    let parityCase = {
      path: 'app/logoooo',
      pattern: 'app/log+(o)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob one-or-more miss', () => {
    let parityCase = {
      path: 'app/log',
      pattern: 'app/log+(o)',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob zero-or-more match zero', () => {
    let parityCase = {
      path: 'app/log',
      pattern: 'app/log*(o)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob zero-or-more match many', () => {
    let parityCase = {
      path: 'app/logoooo',
      pattern: 'app/log*(o)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('composed extglob match one', () => {
    let parityCase = {
      path: 'ac',
      pattern: '+(a)!(b)+(c)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('composed extglob match two', () => {
    let parityCase = {
      path: 'acc',
      pattern: '+(a)!(b)+(c)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('composed extglob match three', () => {
    let parityCase = {
      path: 'adc',
      pattern: '+(a)!(b)+(c)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('composed extglob miss', () => {
    let parityCase = {
      path: 'abc',
      pattern: '+(a)!(b)+(c)',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob with class opening paren literal', () => {
    let parityCase = {
      path: 'a(b',
      pattern: '@(a|a[(])b',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob with class closing paren literal', () => {
    let parityCase = {
      path: 'a)b',
      pattern: '@(a|a[)])b',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob disabled by noext', () => {
    let parityCase = {
      path: 'x.ts',
      pattern: '@(x.ts)',
      options: { noext: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noext literal extglob text', () => {
    let parityCase = {
      path: '@(x.ts)',
      pattern: '@(x.ts)',
      options: { noext: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noext complex extglob literal mismatch', () => {
    let parityCase = {
      path: 'a.ts',
      pattern: '*.@(ts|js)',
      options: { noext: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noext complex extglob literal match', () => {
    let parityCase = {
      path: 'a.@(ts|js)',
      pattern: '*.@(ts|js)',
      options: { noext: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('dot segment excluded by default', () => {
    let parityCase = {
      path: 'a/.d/b',
      pattern: 'a/*/b',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('dot segment included with option', () => {
    let parityCase = {
      path: 'a/.d/b',
      pattern: 'a/*/b',
      options: { dot: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('dot option still excludes dot segment self', () => {
    let parityCase = {
      path: 'a/./b',
      pattern: 'a/*/b',
      options: { dot: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('dot option still excludes parent segment', () => {
    let parityCase = {
      path: 'a/../b',
      pattern: 'a/*/b',
      options: { dot: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('explicit dot pattern works without dot option', () => {
    let parityCase = {
      path: 'a/.d/b',
      pattern: 'a/.*/b',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nocase match', () => {
    let parityCase = {
      path: 'x/Y.ts',
      pattern: 'x/y.ts',
      options: { nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nocase miss without option', () => {
    let parityCase = {
      path: 'x/Y.ts',
      pattern: 'x/y.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nocase full uppercase path', () => {
    let parityCase = {
      path: 'X/Y.TS',
      pattern: 'x/y.ts',
      options: { nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nocase full uppercase path miss without option', () => {
    let parityCase = {
      path: 'X/Y.TS',
      pattern: 'x/y.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noglobstar behaves like star', () => {
    let parityCase = {
      path: 'a/b/d/c',
      pattern: 'a/**/c',
      options: { noglobstar: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noglobstar still matches one segment', () => {
    let parityCase = {
      path: 'a/b/c',
      pattern: 'a/**/c',
      options: { noglobstar: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noglobstar does not recurse in suffix pattern', () => {
    let parityCase = {
      path: 'a/b/c',
      pattern: 'a/**',
      options: { noglobstar: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noglobstar literal double-star text', () => {
    let parityCase = {
      path: 'a/**',
      pattern: 'a/**',
      options: { noglobstar: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase matches basename', () => {
    let parityCase = {
      path: 'x/y/acb',
      pattern: 'a?b',
      options: { matchBase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('without matchBase misses basename', () => {
    let parityCase = {
      path: 'x/y/acb',
      pattern: 'a?b',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase fails when basename differs', () => {
    let parityCase = {
      path: 'x/y/acb/d',
      pattern: 'a?b',
      options: { matchBase: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase handles trailing slash basename', () => {
    let parityCase = {
      path: 'acb/',
      pattern: 'a?b',
      options: { matchBase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase explicit dotfile name', () => {
    let parityCase = {
      path: 'x/y/.env',
      pattern: '.env',
      options: { matchBase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase star excludes dotfile by default', () => {
    let parityCase = {
      path: 'x/y/.env',
      pattern: '*',
      options: { matchBase: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase star includes dotfile with dot option', () => {
    let parityCase = {
      path: 'x/y/.env',
      pattern: '*',
      options: { matchBase: true, dot: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nocase with wildcard suffix', () => {
    let parityCase = {
      path: 'src/APP.TS',
      pattern: 'src/*.ts',
      options: { nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nocase wildcard suffix miss without option', () => {
    let parityCase = {
      path: 'src/APP.TS',
      pattern: 'src/*.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nobrace keeps brace path segment literal', () => {
    let parityCase = {
      path: 'x/{a,b}/c',
      pattern: 'x/{a,b}/c',
      options: { nobrace: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nobrace brace path segment does not expand', () => {
    let parityCase = {
      path: 'x/a/c',
      pattern: 'x/{a,b}/c',
      options: { nobrace: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('globstar sandwich deep tail match', () => {
    let parityCase = {
      path: 'a/b/c/b',
      pattern: 'a/**/b',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nested images segment match', () => {
    let parityCase = {
      path: 'app/home/images/icon.svg',
      pattern: 'app/**/images/*.svg',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nested images segment miss', () => {
    let parityCase = {
      path: 'app/home/icons/icon.svg',
      pattern: 'app/**/images/*.svg',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('single-char wildcard extension jpg', () => {
    let parityCase = {
      path: 'app/photo.jpg',
      pattern: 'app/*.?pg',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('single-char wildcard extension jpeg miss', () => {
    let parityCase = {
      path: 'app/photo.jpeg',
      pattern: 'app/*.?pg',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('stress features-modules routes/views index tsx match', () => {
    let parityCase = {
      path: 'src/features/admin/routes/settings/index.tsx',
      pattern: 'src/**/@(features|modules)/**/{routes,views}/**/index.@(ts|tsx)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('stress features-modules routes/views index jsx miss', () => {
    let parityCase = {
      path: 'src/features/admin/routes/settings/index.jsx',
      pattern: 'src/**/@(features|modules)/**/{routes,views}/**/index.@(ts|tsx)',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('stress route set ext and brace match', () => {
    let parityCase = {
      path: 'app/routes/admin/settings.page.ts',
      pattern:
        'app/routes/{index,about,docs,blog,admin,account}/@(index|settings.page).{ts,tsx,js,jsx}',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('stress route set ext and brace mjs miss', () => {
    let parityCase = {
      path: 'app/routes/admin/settings.page.mjs',
      pattern:
        'app/routes/{index,about,docs,blog,admin,account}/@(index|settings.page).{ts,tsx,js,jsx}',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('stress src-lib-app and extglob plus match', () => {
    let parityCase = {
      path: 'packages/core/src/utils/match-glob.ts',
      pattern: '**/{src,lib,app}/**/*.+(ts|tsx|mts|cts)',
      options: { matchBase: false },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('stress nocase and dot complex match', () => {
    let parityCase = {
      path: 'SRC/.CONFIG/ENV.PROD.TS',
      pattern: '**/.@(config|CONFIG)/**/env.@(prod|dev).@(ts|js)',
      options: { nocase: true, dot: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('stress deep extglob branch match', () => {
    let parityCase = {
      path: 'repo/a/b/c/d/e/f/g/h/i/file.ts',
      pattern: 'repo/**/+(a|b|c|d|e|f|g|h|i)/**/file.@(ts|tsx)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('stress deep extglob branch miss', () => {
    let parityCase = {
      path: 'repo/a/b/c/d/e/f/g/h/i/file.mjs',
      pattern: 'repo/**/+(a|b|c|d|e|f|g|h|i)/**/file.@(ts|tsx)',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple app images recursive wildcard match', () => {
    let parityCase = {
      path: 'app/images/books/cover.png',
      pattern: 'app/images/**/*.*',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple app images recursive wildcard miss without extension', () => {
    let parityCase = {
      path: 'app/images/books/cover',
      pattern: 'app/images/**/*.*',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple assets extension set match', () => {
    let parityCase = {
      path: 'assets/photos/cover.jpeg',
      pattern: 'assets/**/*.{jpg,jpeg,png,gif}',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple assets extension set miss', () => {
    let parityCase = {
      path: 'assets/photos/cover.webp',
      pattern: 'assets/**/*.{jpg,jpeg,png,gif}',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple env prefix glob match', () => {
    let parityCase = {
      path: 'src/.env.local',
      pattern: '**/.env*',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple env prefix glob miss', () => {
    let parityCase = {
      path: 'src/env.local',
      pattern: '**/.env*',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple png basename match', () => {
    let parityCase = {
      path: 'logo.png',
      pattern: '*.png',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple png basename miss', () => {
    let parityCase = {
      path: 'logo.svg',
      pattern: '*.png',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple star-dotstar match', () => {
    let parityCase = {
      path: 'a.b',
      pattern: '*.*',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple star-dotstar miss', () => {
    let parityCase = {
      path: 'ab',
      pattern: '*.*',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple v-star match', () => {
    let parityCase = {
      path: 'v123',
      pattern: 'v*',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple v-star miss', () => {
    let parityCase = {
      path: 'x123',
      pattern: 'v*',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple app recursive root match', () => {
    let parityCase = {
      path: 'app/routes/index.ts',
      pattern: 'app/**',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple app recursive root miss', () => {
    let parityCase = {
      path: 'src/routes/index.ts',
      pattern: 'app/**',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple brace directory and extension match', () => {
    let parityCase = {
      path: 'src/routes/home/page.tsx',
      pattern: 'src/{routes,components}/**/*.{ts,tsx}',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple brace directory and extension miss', () => {
    let parityCase = {
      path: 'src/utils/home/page.tsx',
      pattern: 'src/{routes,components}/**/*.{ts,tsx}',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple top-level extension set match tsx', () => {
    let parityCase = {
      path: 'src/main.tsx',
      pattern: 'src/*.{ts,tsx}',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple top-level extension set match ts', () => {
    let parityCase = {
      path: 'src/main.ts',
      pattern: 'src/*.{ts,tsx}',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple top-level extension set miss nested', () => {
    let parityCase = {
      path: 'src/nested/main.tsx',
      pattern: 'src/*.{ts,tsx}',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('simple top-level extension set miss wrong extension', () => {
    let parityCase = {
      path: 'src/main.js',
      pattern: 'src/*.{ts,tsx}',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('dotfile ts under globstar excluded by default', () => {
    let parityCase = {
      path: 'src/.config/env.ts',
      pattern: 'src/**/*.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('dotfile ts under globstar included with dot option', () => {
    let parityCase = {
      path: 'src/.config/env.ts',
      pattern: 'src/**/*.ts',
      options: { dot: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob one-or-more extension match tsx', () => {
    let parityCase = {
      path: 'app/main.tsx',
      pattern: 'app/*.+(ts|tsx)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob one-or-more extension miss js', () => {
    let parityCase = {
      path: 'app/main.js',
      pattern: 'app/*.+(ts|tsx)',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob optional suffix matches empty', () => {
    let parityCase = {
      path: 'app/file',
      pattern: 'app/file?(.map)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob optional suffix matches map', () => {
    let parityCase = {
      path: 'app/file.map',
      pattern: 'app/file?(.map)',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('extglob optional suffix misses other extension', () => {
    let parityCase = {
      path: 'app/file.mapp',
      pattern: 'app/file?(.map)',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('character range match becomes nocase true', () => {
    let parityCase = {
      path: 'A.ts',
      pattern: '[a-z].ts',
      options: { nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('character range miss with nocase false', () => {
    let parityCase = {
      path: 'A.ts',
      pattern: '[a-z].ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase explicit dotfile with nocase match', () => {
    let parityCase = {
      path: 'SRC/.ENV',
      pattern: '.env',
      options: { matchBase: true, nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase wildcard dotfile still excluded with nocase', () => {
    let parityCase = {
      path: 'SRC/.ENV',
      pattern: '*',
      options: { matchBase: true, nocase: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase wildcard dotfile included with dot and nocase', () => {
    let parityCase = {
      path: 'SRC/.ENV',
      pattern: '*',
      options: { matchBase: true, nocase: true, dot: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase nocase extension match', () => {
    let parityCase = {
      path: 'src/app.test.TS',
      pattern: '*.ts',
      options: { matchBase: true, nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('without matchBase nocase extension miss on nested path', () => {
    let parityCase = {
      path: 'src/app.test.TS',
      pattern: '*.ts',
      options: { nocase: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noext nocase literal extglob text match', () => {
    let parityCase = {
      path: 'A.@(TS|JS)',
      pattern: '*.@(ts|js)',
      options: { noext: true, nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noext literal extglob text case-sensitive miss', () => {
    let parityCase = {
      path: 'A.@(TS|JS)',
      pattern: '*.@(ts|js)',
      options: { noext: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noext nocase does not treat extglob as syntax', () => {
    let parityCase = {
      path: 'A.ts',
      pattern: '*.@(ts|js)',
      options: { noext: true, nocase: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nobrace nocase literal brace text match', () => {
    let parityCase = {
      path: 'X.{TS,JS}',
      pattern: 'x.{ts,js}',
      options: { nobrace: true, nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nobrace nocase does not expand brace alternatives', () => {
    let parityCase = {
      path: 'x.ts',
      pattern: 'x.{ts,js}',
      options: { nobrace: true, nocase: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('brace alternatives still expand with nocase', () => {
    let parityCase = {
      path: 'X.TS',
      pattern: 'x.{ts,js}',
      options: { nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noglobstar treats double-star as single segment wildcard miss', () => {
    let parityCase = {
      path: 'a/b/c.ts',
      pattern: '**/*.ts',
      options: { noglobstar: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noglobstar treats double-star as single segment wildcard match', () => {
    let parityCase = {
      path: 'b/c.ts',
      pattern: '**/*.ts',
      options: { noglobstar: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noglobstar still respects dot exclusion by default', () => {
    let parityCase = {
      path: '.b/c.ts',
      pattern: '**/*.ts',
      options: { noglobstar: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noglobstar dot option allows leading dot segment', () => {
    let parityCase = {
      path: '.b/c.ts',
      pattern: '**/*.ts',
      options: { noglobstar: true, dot: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noext matchBase literal extglob basename match', () => {
    let parityCase = {
      path: 'x/@(a|b).ts',
      pattern: '@(a|b).ts',
      options: { noext: true, matchBase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noext matchBase literal extglob basename miss', () => {
    let parityCase = {
      path: 'x/a.ts',
      pattern: '@(a|b).ts',
      options: { noext: true, matchBase: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase dot and nocase explicit dotfile nested match', () => {
    let parityCase = {
      path: 'X/Y/.ENV',
      pattern: '.env',
      options: { matchBase: true, nocase: true, dot: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase nocase explicit dotfile nested match without dot option', () => {
    let parityCase = {
      path: 'X/Y/.ENV',
      pattern: '.env',
      options: { matchBase: true, nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('nocase extglob syntax match', () => {
    let parityCase = {
      path: 'APP/MAIN.TSX',
      pattern: 'app/*.@(ts|tsx)',
      options: { nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noext nocase extglob syntax disabled miss', () => {
    let parityCase = {
      path: 'APP/MAIN.TSX',
      pattern: 'app/*.@(ts|tsx)',
      options: { noext: true, nocase: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('noext nocase extglob literal text match', () => {
    let parityCase = {
      path: 'APP/MAIN.@(TS|TSX)',
      pattern: 'app/*.@(ts|tsx)',
      options: { noext: true, nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase and noglobstar basename match', () => {
    let parityCase = {
      path: 'a/b/file.ts',
      pattern: '*.ts',
      options: { matchBase: true, noglobstar: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('matchBase and noglobstar basename miss', () => {
    let parityCase = {
      path: 'a/b/file.js',
      pattern: '*.ts',
      options: { matchBase: true, noglobstar: true },
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('dot nocase explicit segment match', () => {
    let parityCase = {
      path: 'a/.Config/b',
      pattern: 'a/.config/b',
      options: { nocase: true },
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('globstar recursive exact old path variant', () => {
    let parityCase = {
      path: 'a/b/c',
      pattern: 'a/**/c',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('globstar sandwich exact old path variant', () => {
    let parityCase = {
      path: 'a/b',
      pattern: 'a/**/b',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('brace extension set default match old path variant', () => {
    let parityCase = {
      path: 'x.ts',
      pattern: 'x.{ts,js}',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('multi-digit numeric brace range match', () => {
    let parityCase = {
      path: '10/file.ts',
      pattern: '{10..12}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('multi-digit numeric brace range literal miss', () => {
    let parityCase = {
      path: '10..12/file.ts',
      pattern: '{10..12}/file.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('uppercase alpha brace range match', () => {
    let parityCase = {
      path: 'B/file.ts',
      pattern: '{A..C}/file.ts',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('uppercase alpha brace range literal miss', () => {
    let parityCase = {
      path: 'A..C/file.ts',
      pattern: '{A..C}/file.ts',
      options: {},
      expected: false,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    type AssertCase = AssertIsTrue<AssertTypes<typeof parityCase>>
  })

  test('known gap: posix alpha unicode match', () => {
    let parityCase = {
      path: '\u00E9',
      pattern: '[[:alpha:]]',
      options: {},
      expected: true,
    } as const satisfies ParityCase
    let actual = minimatch(parityCase.path, parityCase.pattern, parityCase.options)
    assert.equal(actual, parityCase.expected)
    // @ts-ignore tsc and tsx disagree on this
    type AssertPublicGap = AssertIsTrue<IsEqual<PublicMatchResult<typeof parityCase>, false>>
    // @ts-ignore tsc and tsx disagree on this
    type AssertAdvancedGap = AssertIsTrue<IsEqual<AdvancedMatchResult<typeof parityCase>, false>>
    type AssertMirroredGap = AssertIsTrue<
      IsEqual<AdvancedMatchResult<typeof parityCase>, PublicMatchResult<typeof parityCase>>
    >
  })
})
