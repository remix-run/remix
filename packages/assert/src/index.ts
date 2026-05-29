import {
  AssertionError,
  assert as assertFn,
  deepEqual,
  doesNotMatch,
  doesNotReject,
  doesNotThrow,
  equal,
  fail,
  match,
  notDeepEqual,
  notEqual,
  ok,
  partialDeepEqual,
  rejects,
  throws,
} from './lib/assert.ts'

export * from './lib/assert.ts'
export { expect, type Expect, type Expectation } from './lib/expect.ts'

interface Assert {
  (value: unknown, message?: string): asserts value
  AssertionError: typeof AssertionError
  assert: typeof assertFn
  ok: typeof ok
  equal: typeof equal
  notEqual: typeof notEqual
  deepEqual: typeof deepEqual
  partialDeepEqual: typeof partialDeepEqual
  notDeepEqual: typeof notDeepEqual
  fail: typeof fail
  match: typeof match
  doesNotMatch: typeof doesNotMatch
  throws: typeof throws
  doesNotThrow: typeof doesNotThrow
  rejects: typeof rejects
  doesNotReject: typeof doesNotReject
}

const assert: Assert = Object.assign(assertFn, {
  AssertionError,
  assert: assertFn,
  ok,
  equal,
  notEqual,
  deepEqual,
  partialDeepEqual,
  notDeepEqual,
  fail,
  match,
  doesNotMatch,
  throws,
  doesNotThrow,
  rejects,
  doesNotReject,
})

export default assert
