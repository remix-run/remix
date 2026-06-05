import * as nodeAssert from 'node:assert/strict'
import { describe, it } from 'node:test'

import defaultAssert from '../index.ts'
import * as assert from './assert.ts'

describe('AssertionError', () => {
  it('sets name, message, actual, expected, and operator', () => {
    let err = new assert.AssertionError({
      message: 'msg',
      actual: 1,
      expected: 2,
      operator: 'equal',
    })
    nodeAssert.equal(err.name, 'AssertionError')
    nodeAssert.equal(err.message, 'msg')
    nodeAssert.equal(err.actual, 1)
    nodeAssert.equal(err.expected, 2)
    nodeAssert.equal(err.operator, 'equal')
    nodeAssert.equal(err.generatedMessage, false)
    nodeAssert.equal(err.code, 'ERR_ASSERTION')
  })
})

describe('assert.ok', () => {
  it('passes for truthy values', () => {
    assert.ok(true)
    assert.ok(1)
    assert.ok('str')
  })

  it('throws AssertionError for falsy values', () => {
    nodeAssert.throws(() => assert.ok(false), assert.AssertionError)
    nodeAssert.throws(() => assert.ok(0), assert.AssertionError)
    nodeAssert.throws(() => assert.ok(''), assert.AssertionError)
  })
})

describe('default export', () => {
  it('is callable as an alias for ok', () => {
    defaultAssert(true)
    nodeAssert.throws(() => defaultAssert(false), assert.AssertionError)
  })

  it('exposes assertion methods as properties', () => {
    defaultAssert.equal(1, 1)
    defaultAssert.deepEqual({ a: 1 }, { a: 1 })
    defaultAssert.partialDeepEqual({ a: 1, b: 2 }, { a: 1 })
    defaultAssert.match('hello world', /world/)
  })
})

describe('assert.equal', () => {
  it('passes for strictly equal values', () => {
    assert.equal(1, 1)
    assert.equal('a', 'a')
    assert.equal(NaN, NaN)
  })

  it('throws for type-coerced values', () => {
    nodeAssert.throws(() => assert.equal(1 as any, '1'), assert.AssertionError)
    nodeAssert.throws(() => assert.equal(null as any, undefined), assert.AssertionError)
    nodeAssert.throws(() => assert.equal(0 as any, false), assert.AssertionError)
    nodeAssert.throws(() => assert.equal(0, -0), assert.AssertionError)
  })

  it('throws for unequal values', () => {
    nodeAssert.throws(() => assert.equal(1, 2), assert.AssertionError)
  })

  it('throws a custom Error message directly', () => {
    let error = new Error('custom')
    nodeAssert.throws(() => assert.equal(1, 2, error), error)
  })
})

describe('assert.notEqual', () => {
  it('passes for strictly unequal values', () => {
    assert.notEqual(1, 2)
    assert.notEqual(1 as any, '1')
    assert.notEqual(null as any, undefined)
    assert.notEqual(0, -0)
  })

  it('throws for strictly equal values', () => {
    nodeAssert.throws(() => assert.notEqual(1, 1), assert.AssertionError)
    nodeAssert.throws(() => assert.notEqual('a', 'a'), assert.AssertionError)
    nodeAssert.throws(() => assert.notEqual(NaN, NaN), assert.AssertionError)
  })
})

describe('assert.deepEqual', () => {
  it('passes for deeply equal objects', () => {
    assert.deepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] })
  })

  it('passes for strictly equal primitives', () => {
    assert.deepEqual(42, 42)
  })

  it('throws for type-coerced values', () => {
    nodeAssert.throws(() => assert.deepEqual({ a: 1 } as any, { a: '1' }), assert.AssertionError)
    nodeAssert.throws(() => assert.deepEqual(1 as any, '1'), assert.AssertionError)
  })

  it('throws for structurally unequal objects', () => {
    nodeAssert.throws(() => assert.deepEqual({ a: 1 }, { a: 2 }), assert.AssertionError)
    nodeAssert.throws(() => assert.deepEqual({ a: 1 }, { a: 1, b: 2 }), assert.AssertionError)
    nodeAssert.throws(
      () => assert.deepEqual({ a: undefined }, { b: undefined }),
      assert.AssertionError,
    )
  })

  it('matches Node strict equality edge cases', () => {
    assert.deepEqual(NaN, NaN)
    nodeAssert.throws(() => assert.deepEqual(0, -0), assert.AssertionError)
  })

  it('compares built-in object values', () => {
    assert.deepEqual(new Date(1), new Date(1))
    nodeAssert.throws(() => assert.deepEqual(new Date(1), new Date(2)), assert.AssertionError)

    let actualRegExp = /hello/g
    let expectedRegExp = /hello/g
    actualRegExp.lastIndex = 1
    expectedRegExp.lastIndex = 1
    assert.deepEqual(actualRegExp, expectedRegExp)
    expectedRegExp.lastIndex = 2
    nodeAssert.throws(() => assert.deepEqual(actualRegExp, expectedRegExp), assert.AssertionError)

    assert.deepEqual(new Error('boom'), new Error('boom'))
    nodeAssert.throws(
      () => assert.deepEqual(new Error('boom'), new Error('bad')),
      assert.AssertionError,
    )

    assert.deepEqual(new URLSearchParams('a=1'), new URLSearchParams('b=2'))
  })

  it('compares maps, sets, typed arrays, and symbol properties', () => {
    assert.deepEqual(new Map([[{ a: 1 }, new Set([2, 3])]]), new Map([[{ a: 1 }, new Set([3, 2])]]))
    nodeAssert.throws(
      () => assert.deepEqual(new Map([['a', 1]]), new Map([['a', 2]])),
      assert.AssertionError,
    )

    assert.deepEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))
    nodeAssert.throws(
      () => assert.deepEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])),
      assert.AssertionError,
    )

    let symbol = Symbol('key')
    assert.deepEqual({ [symbol]: 1 }, { [symbol]: 1 })
    nodeAssert.throws(
      () => assert.deepEqual({ [symbol]: 1 }, { [symbol]: 2 }),
      assert.AssertionError,
    )
  })

  it('compares prototypes and cycles', () => {
    nodeAssert.throws(() => assert.deepEqual(Object.create(null), {}), assert.AssertionError)

    interface CyclicValue {
      name: string
      self?: CyclicValue
    }

    let actual: CyclicValue = { name: 'actual' }
    actual.self = actual

    let expected: CyclicValue = { name: 'actual' }
    expected.self = expected

    assert.deepEqual(actual, expected)
  })
})

describe('assert.partialDeepEqual', () => {
  it('passes when actual contains the expected object structure', () => {
    let key = Symbol('key')

    assert.partialDeepEqual({ a: { b: 1, c: 2 }, d: 3, [key]: 4 }, { a: { b: 1 }, [key]: 4 })
  })

  it('throws when expected properties are missing or different', () => {
    nodeAssert.throws(
      () => assert.partialDeepEqual({ a: { b: 1 } }, { a: { b: 2 } }),
      assert.AssertionError,
    )
    nodeAssert.throws(() => assert.partialDeepEqual({}, { a: undefined }), assert.AssertionError)
  })

  it('matches array and byte subsequences', () => {
    assert.partialDeepEqual([1, 2, 3], [1, 2])
    assert.partialDeepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9], [4, 5, 8])
    nodeAssert.throws(() => assert.partialDeepEqual([1], [1, 2]), assert.AssertionError)
    nodeAssert.throws(() => assert.partialDeepEqual([1, 2, 3], [2, 1]), assert.AssertionError)

    assert.partialDeepEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))
    assert.partialDeepEqual(new Uint8Array([1, 2, 3]), new Uint8Array([2, 3]))
    nodeAssert.throws(
      () => assert.partialDeepEqual(new Uint8Array([1, 3, 3]), new Uint8Array([1, 2])),
      assert.AssertionError,
    )

    let actualBuffer = Object.assign(new Uint8Array([1, 2, 3]).buffer, { label: 'ok' })
    let expectedBuffer = Object.assign(new Uint8Array([2, 3]).buffer, { label: 'ok' })
    assert.partialDeepEqual(actualBuffer, expectedBuffer)
  })

  it('matches map and set subsets with partial keys and values', () => {
    assert.partialDeepEqual(
      new Map([
        [
          { a: 1, b: 2 },
          { c: 3, d: 4 },
        ],
      ]),
      new Map([[{ a: 1 }, { c: 3 }]]),
    )
    nodeAssert.throws(
      () => assert.partialDeepEqual(new Map([[{ a: 1 }, 'value']]), new Map([[{ b: 1 }, 'value']])),
      assert.AssertionError,
    )

    assert.partialDeepEqual(new Set([{ a: 1, b: 2 }]), new Set([{ a: 1 }]))
    nodeAssert.throws(
      () => assert.partialDeepEqual(new Set([{ a: 1 }]), new Set([{ a: 2 }])),
      assert.AssertionError,
    )
  })

  it('matches Error cause and AggregateError errors partially', () => {
    assert.partialDeepEqual(
      new Error('boom', { cause: { code: 'ERR_TEST', detail: 'extra' } }),
      new Error('boom', { cause: { code: 'ERR_TEST' } }),
    )
    nodeAssert.throws(
      () => assert.partialDeepEqual(new Error('boom'), new Error('boom', { cause: 'missing' })),
      assert.AssertionError,
    )

    assert.partialDeepEqual(new AggregateError([1, 2], 'boom'), new AggregateError([1], 'boom'))
  })

  it('does not require matching object prototypes', () => {
    class Result {
      id = 1
      name = 'Alice'
    }

    assert.partialDeepEqual(new Result(), { id: 1 })
  })

  it('throws a custom Error message directly', () => {
    let error = new Error('custom partial failure')
    nodeAssert.throws(() => assert.partialDeepEqual({ a: 1 }, { a: 2 }, error), error)
  })
})

describe('assert.notDeepEqual', () => {
  it('passes for objects that differ', () => {
    assert.notDeepEqual({ a: 1 }, { a: 2 })
    assert.notDeepEqual({ a: 1 } as any, { a: '1' })
    assert.notDeepEqual({ a: undefined }, { b: undefined })
  })

  it('throws for deeply strictly equal objects', () => {
    nodeAssert.throws(() => assert.notDeepEqual({ a: 1 }, { a: 1 }), assert.AssertionError)
  })
})

describe('assert.fail', () => {
  it('always throws AssertionError', () => {
    nodeAssert.throws(() => assert.fail(), assert.AssertionError)
  })

  it('uses custom message', () => {
    let err: assert.AssertionError | undefined
    try {
      assert.fail('custom fail')
    } catch (e) {
      err = e as assert.AssertionError
    }
    nodeAssert.equal(err?.message, 'custom fail')
  })

  it('throws a custom Error message directly', () => {
    let error = new Error('custom fail')
    nodeAssert.throws(() => assert.fail(error), error)
  })
})

describe('assert.match', () => {
  it('passes when string matches regexp', () => {
    assert.match('hello world', /world/)
  })

  it('throws when string does not match regexp', () => {
    nodeAssert.throws(() => assert.match('hello world', /foo/), assert.AssertionError)
  })

  it('throws AssertionError when the input is not a string', () => {
    nodeAssert.throws(() => assert.match(123 as any, /foo/), assert.AssertionError)
  })
})

describe('assert.doesNotMatch', () => {
  it('passes when string does not match regexp', () => {
    assert.doesNotMatch('hello world', /foo/)
  })

  it('throws when string matches regexp', () => {
    nodeAssert.throws(() => assert.doesNotMatch('hello world', /world/), assert.AssertionError)
  })

  it('throws AssertionError when the input is not a string', () => {
    nodeAssert.throws(() => assert.doesNotMatch(123 as any, /foo/), assert.AssertionError)
  })
})

describe('assert.throws', () => {
  it('passes when function throws', () => {
    assert.throws(() => {
      throw new Error('oops')
    })
  })

  it('throws AssertionError when function does not throw', () => {
    nodeAssert.throws(() => assert.throws(() => {}), assert.AssertionError)
  })

  it('treats a string second argument as the failure message', () => {
    assert.throws(() => {
      throw new Error('oops')
    }, 'custom failure')

    let err = capture(() => assert.throws(() => {}, 'custom failure'))
    nodeAssert.equal(err?.message, 'Missing expected exception: custom failure')
    nodeAssert.equal(err?.generatedMessage, false)
  })

  it('validates error constructor', () => {
    assert.throws(() => {
      throw new Error('bad')
    }, Error)

    assert.throws(() => {
      throw new TypeError('bad type')
    }, TypeError)
  })

  it('throws when error is wrong constructor', () => {
    nodeAssert.throws(
      () =>
        assert.throws(() => {
          throw new Error('not a type error')
        }, TypeError),
      assert.AssertionError,
    )
  })

  it('validates error against an object of expected properties', () => {
    assert.throws(
      () => {
        let err = new Error('boom') as NodeJS.ErrnoException
        err.code = 'ERR_INVALID_ARG_VALUE'
        throw err
      },
      { code: 'ERR_INVALID_ARG_VALUE', message: 'boom' },
    )
  })

  it('validates error instances with their own properties', () => {
    let expected = new Error('boom') as NodeJS.ErrnoException
    expected.code = 'ERR_INVALID_ARG_VALUE'

    assert.throws(() => {
      let err = new Error('boom') as NodeJS.ErrnoException
      err.code = 'ERR_INVALID_ARG_VALUE'
      throw err
    }, expected)

    nodeAssert.throws(
      () =>
        assert.throws(() => {
          let err = new Error('boom') as NodeJS.ErrnoException
          err.code = 'ERR_OTHER'
          throw err
        }, expected),
      assert.AssertionError,
    )
  })

  it('matches RegExp values inside an object validator against string properties', () => {
    assert.throws(
      () => {
        throw new Error('boom: bad input')
      },
      { message: /bad input/ },
    )
  })

  it('throws when an object validator property does not match', () => {
    nodeAssert.throws(
      () =>
        assert.throws(
          () => {
            let err = new Error('boom') as NodeJS.ErrnoException
            err.code = 'ERR_OTHER'
            throw err
          },
          { code: 'ERR_INVALID_ARG_VALUE' },
        ),
      assert.AssertionError,
    )
  })

  it('validates expected error argument shapes', () => {
    nodeAssert.throws(() => assert.throws(123 as any), TypeError)
    nodeAssert.throws(
      () =>
        assert.throws(() => {
          throw new Error('oops')
        }, {}),
      TypeError,
    )
    nodeAssert.throws(
      () =>
        assert.throws(() => {
          throw new Error('oops')
        }, true),
      TypeError,
    )
  })

  it('requires validator functions to return true', () => {
    nodeAssert.throws(
      () =>
        assert.throws(
          () => {
            throw new Error('oops')
          },
          () => 'truthy',
        ),
      assert.AssertionError,
    )
  })
})

describe('assert.doesNotThrow', () => {
  it('passes when function does not throw', () => {
    assert.doesNotThrow(() => {})
  })

  it('throws AssertionError when function throws', () => {
    nodeAssert.throws(
      () =>
        assert.doesNotThrow(() => {
          throw new Error('oops')
        }),
      assert.AssertionError,
    )
  })

  it('validates arguments after an unwanted throw', () => {
    nodeAssert.throws(() => assert.doesNotThrow(123 as any), TypeError)
    nodeAssert.throws(
      () =>
        assert.doesNotThrow(() => {
          throw new Error('oops')
        }, {}),
      TypeError,
    )
  })

  it('treats Error constructors as expected matchers', () => {
    nodeAssert.throws(
      () =>
        assert.doesNotThrow(() => {
          throw new Error('oops')
        }, Error),
      assert.AssertionError,
    )
  })

  it('rethrows when thrown errors do not match the expected error', () => {
    let error = new TypeError('oops')
    nodeAssert.throws(
      () =>
        assert.doesNotThrow(() => {
          throw error
        }, SyntaxError),
      error,
    )
  })
})

describe('assert.rejects', () => {
  it('passes when promise rejects', async () => {
    await assert.rejects(() => Promise.reject(new Error('oops')))
  })

  it('throws AssertionError when promise resolves', async () => {
    await nodeAssert.rejects(() => assert.rejects(() => Promise.resolve()), assert.AssertionError)
  })

  it('treats a string second argument as the failure message', async () => {
    await assert.rejects(() => Promise.reject(new Error('oops')), 'custom failure')

    let err = await captureAsync(() => assert.rejects(() => Promise.resolve(), 'custom failure'))
    nodeAssert.equal(err?.message, 'Missing expected rejection: custom failure')
    nodeAssert.equal(err?.generatedMessage, false)
  })

  it('propagates errors thrown synchronously by the promise function', async () => {
    let error = new Error('sync')
    await nodeAssert.rejects(
      () =>
        assert.rejects(() => {
          throw error
        }),
      error,
    )
  })

  it('validates error constructor', async () => {
    await assert.rejects(() => Promise.reject(new Error('bad')), Error)
    await assert.rejects(() => Promise.reject(new TypeError('bad type')), TypeError)
  })

  it('validates rejection against an object of expected properties', async () => {
    let err = new Error('boom') as NodeJS.ErrnoException
    err.code = 'ERR_INVALID_ARG_VALUE'

    await assert.rejects(() => Promise.reject(err), {
      code: 'ERR_INVALID_ARG_VALUE',
      message: /boom/,
    })
  })

  it('validates promise and expected error argument shapes', async () => {
    await nodeAssert.rejects(() => assert.rejects(123 as any), TypeError)
    await nodeAssert.rejects(() => assert.rejects(() => 123 as any), TypeError)
    await nodeAssert.rejects(
      () => assert.rejects(() => Promise.reject(new Error('oops')), {}),
      TypeError,
    )
    await nodeAssert.rejects(
      () => assert.rejects(() => Promise.reject(new Error('oops')), true),
      TypeError,
    )
  })
})

describe('assert.doesNotReject', () => {
  it('passes when promise resolves', async () => {
    await assert.doesNotReject(() => Promise.resolve())
  })

  it('throws AssertionError when promise rejects', async () => {
    await nodeAssert.rejects(
      () => assert.doesNotReject(() => Promise.reject(new Error('oops'))),
      assert.AssertionError,
    )
  })

  it('validates promise and expected error argument shapes', async () => {
    await nodeAssert.rejects(() => assert.doesNotReject(123 as any), TypeError)
    await nodeAssert.rejects(() => assert.doesNotReject(() => 123 as any), TypeError)
    await nodeAssert.rejects(
      () => assert.doesNotReject(() => Promise.reject(new Error('oops')), {}),
      TypeError,
    )
  })

  it('rethrows when rejection errors do not match the expected error', async () => {
    let error = new TypeError('oops')
    await nodeAssert.rejects(
      () => assert.doesNotReject(() => Promise.reject(error), SyntaxError),
      error,
    )
  })
})

// ---------------------------------------------------------------------------
// node:assert/strict compatibility — verifies that our errors match node's
// on the fields that matter: name, code, operator, generatedMessage, actual, expected.
// ---------------------------------------------------------------------------

describe('node:assert/strict compatibility', () => {
  it('ok — pass and fail cases', () => {
    for (let value of [true, 1, 'str']) {
      assertCompatibleError(
        capture(() => assert.ok(value)),
        capture(() => nodeAssert.ok(value)),
      )
    }
    for (let value of [false, 0, '']) {
      assertCompatibleError(
        capture(() => assert.ok(value)),
        capture(() => nodeAssert.ok(value)),
      )
    }
  })

  it('equal (strictEqual) — pass and fail cases', () => {
    assertCompatibleError(
      capture(() => assert.equal(1, 1)),
      capture(() => nodeAssert.strictEqual(1, 1)),
    )
    assertCompatibleError(
      capture(() => assert.equal(1, 2)),
      capture(() => nodeAssert.strictEqual(1, 2)),
    )
    assertCompatibleError(
      capture(() => assert.equal(1 as any, '1')),
      capture(() => nodeAssert.strictEqual(1, '1' as any)),
    )
  })

  it('notEqual (notStrictEqual) — pass and fail cases', () => {
    assertCompatibleError(
      capture(() => assert.notEqual(1, 2)),
      capture(() => nodeAssert.notStrictEqual(1, 2)),
    )
    assertCompatibleError(
      capture(() => assert.notEqual(1, 1)),
      capture(() => nodeAssert.notStrictEqual(1, 1)),
    )
    assertCompatibleError(
      capture(() => assert.notEqual(1 as any, '1')),
      capture(() => nodeAssert.notStrictEqual(1, '1' as any)),
    )
  })

  it('deepEqual (deepStrictEqual) — pass and fail cases', () => {
    assertCompatibleError(
      capture(() => assert.deepEqual({ x: 1 }, { x: 1 })),
      capture(() => nodeAssert.deepStrictEqual({ x: 1 }, { x: 1 })),
    )
    assertCompatibleError(
      capture(() => assert.deepEqual({ x: 1 }, { x: 2 })),
      capture(() => nodeAssert.deepStrictEqual({ x: 1 }, { x: 2 })),
    )
    assertCompatibleError(
      capture(() => assert.deepEqual({ x: 1 } as any, { x: '1' })),
      capture(() => nodeAssert.deepStrictEqual({ x: 1 }, { x: '1' } as any)),
    )
  })

  it('notDeepEqual (notDeepStrictEqual) — pass and fail cases', () => {
    assertCompatibleError(
      capture(() => assert.notDeepEqual({ x: 1 }, { x: 2 })),
      capture(() => nodeAssert.notDeepStrictEqual({ x: 1 }, { x: 2 })),
    )
    assertCompatibleError(
      capture(() => assert.notDeepEqual({ x: 1 }, { x: 1 })),
      capture(() => nodeAssert.notDeepStrictEqual({ x: 1 }, { x: 1 })),
    )
    assertCompatibleError(
      capture(() => assert.notDeepEqual({ x: 1 } as any, { x: '1' })),
      capture(() => nodeAssert.notDeepStrictEqual({ x: 1 }, { x: '1' } as any)),
    )
  })

  it('partialDeepEqual (partialDeepStrictEqual) — pass and fail cases', () => {
    assertCompatibleError(
      capture(() => assert.partialDeepEqual({ x: 1, y: 2 }, { x: 1 })),
      capture(() => nodeAssert.partialDeepStrictEqual({ x: 1, y: 2 }, { x: 1 })),
    )
    assertCompatibleError(
      capture(() => assert.partialDeepEqual({ x: 1 }, { x: 1, y: 2 })),
      capture(() => nodeAssert.partialDeepStrictEqual({ x: 1 }, { x: 1, y: 2 })),
    )
    assertCompatibleError(
      capture(() => assert.partialDeepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9], [4, 5, 8])),
      capture(() => nodeAssert.partialDeepStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9], [4, 5, 8])),
    )
  })

  it('fail — always throws', () => {
    assertCompatibleError(
      capture(() => assert.fail()),
      capture(() => nodeAssert.fail()),
    )
  })

  it('match — pass and fail cases', () => {
    assertCompatibleError(
      capture(() => assert.match('hello world', /world/)),
      capture(() => nodeAssert.match('hello world', /world/)),
    )
    assertCompatibleError(
      capture(() => assert.match('hello world', /foo/)),
      capture(() => nodeAssert.match('hello world', /foo/)),
    )
  })

  it('throws — pass and fail cases', () => {
    let throwing = () => {
      throw new Error('oops')
    }
    let silent = () => {}
    assertCompatibleError(
      capture(() => assert.throws(throwing)),
      capture(() => nodeAssert.throws(throwing)),
    )
    assertCompatibleError(
      capture(() => assert.throws(silent)),
      capture(() => nodeAssert.throws(silent)),
    )
  })

  it('rejects — pass and fail cases', async () => {
    let rejecting = () => Promise.reject(new Error('oops'))
    let resolving = () => Promise.resolve()
    assertCompatibleError(
      await captureAsync(() => assert.rejects(rejecting)),
      await captureAsync(() => nodeAssert.rejects(rejecting)),
    )
    assertCompatibleError(
      await captureAsync(() => assert.rejects(resolving)),
      await captureAsync(() => nodeAssert.rejects(resolving)),
    )
  })

  it('doesNotMatch — pass and fail cases', () => {
    assertCompatibleError(
      capture(() => assert.doesNotMatch('hello world', /foo/)),
      capture(() => nodeAssert.doesNotMatch('hello world', /foo/)),
    )
    assertCompatibleError(
      capture(() => assert.doesNotMatch('hello world', /world/)),
      capture(() => nodeAssert.doesNotMatch('hello world', /world/)),
    )
  })

  it('doesNotThrow — pass and fail cases', () => {
    let throwing = () => {
      throw new Error('oops')
    }
    let silent = () => {}
    assertCompatibleError(
      capture(() => assert.doesNotThrow(silent)),
      capture(() => nodeAssert.doesNotThrow(silent)),
    )
    assertCompatibleError(
      capture(() => assert.doesNotThrow(throwing)),
      capture(() => nodeAssert.doesNotThrow(throwing)),
    )
  })

  it('doesNotReject — pass and fail cases', async () => {
    let rejecting = () => Promise.reject(new Error('oops'))
    let resolving = () => Promise.resolve()
    assertCompatibleError(
      await captureAsync(() => assert.doesNotReject(resolving)),
      await captureAsync(() => nodeAssert.doesNotReject(resolving)),
    )
    assertCompatibleError(
      await captureAsync(() => assert.doesNotReject(rejecting)),
      await captureAsync(() => nodeAssert.doesNotReject(rejecting)),
    )
  })
})

function capture(fn: () => void): nodeAssert.AssertionError | null {
  try {
    fn()
    return null
  } catch (e) {
    return e as nodeAssert.AssertionError
  }
}

async function captureAsync(fn: () => Promise<void>): Promise<nodeAssert.AssertionError | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return e as nodeAssert.AssertionError
  }
}

function assertCompatibleError(
  ours: nodeAssert.AssertionError | null,
  nodes: nodeAssert.AssertionError | null,
) {
  nodeAssert.equal(ours === null, nodes === null, 'throw/pass disagrees with node:assert/strict')
  if (ours && nodes) {
    nodeAssert.equal(ours.name, nodes.name)
    nodeAssert.equal(ours.code, nodes.code)
    nodeAssert.equal(ours.operator, nodes.operator)
    nodeAssert.equal(ours.generatedMessage, nodes.generatedMessage)
    nodeAssert.deepEqual(ours.actual, nodes.actual)
    nodeAssert.deepEqual(ours.expected, nodes.expected)
  }
}
