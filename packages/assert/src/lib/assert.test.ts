import * as nodeAssert from 'node:assert/strict'
import { describe, it } from '@remix-run/test'

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

describe('assert.equal', () => {
  it('passes for strictly equal values', () => {
    assert.equal(1, 1)
    assert.equal('a', 'a')
  })

  it('throws for type-coerced values', () => {
    nodeAssert.throws(() => assert.equal(1 as any, '1'), assert.AssertionError)
    nodeAssert.throws(() => assert.equal(null as any, undefined), assert.AssertionError)
    nodeAssert.throws(() => assert.equal(0 as any, false), assert.AssertionError)
  })

  it('throws for unequal values', () => {
    nodeAssert.throws(() => assert.equal(1, 2), assert.AssertionError)
  })
})

describe('assert.notEqual', () => {
  it('passes for strictly unequal values', () => {
    assert.notEqual(1, 2)
    assert.notEqual(1 as any, '1')
    assert.notEqual(null as any, undefined)
  })

  it('throws for strictly equal values', () => {
    nodeAssert.throws(() => assert.notEqual(1, 1), assert.AssertionError)
    nodeAssert.throws(() => assert.notEqual('a', 'a'), assert.AssertionError)
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
  })
})

describe('assert.notDeepEqual', () => {
  it('passes for objects that differ', () => {
    assert.notDeepEqual({ a: 1 }, { a: 2 })
    assert.notDeepEqual({ a: 1 } as any, { a: '1' })
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
})

describe('assert.match', () => {
  it('passes when string matches regexp', () => {
    assert.match('hello world', /world/)
  })

  it('throws when string does not match regexp', () => {
    nodeAssert.throws(() => assert.match('hello world', /foo/), assert.AssertionError)
  })
})

describe('assert.doesNotMatch', () => {
  it('passes when string does not match regexp', () => {
    assert.doesNotMatch('hello world', /foo/)
  })

  it('throws when string matches regexp', () => {
    nodeAssert.throws(() => assert.doesNotMatch('hello world', /world/), assert.AssertionError)
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

  it('validates error constructor', () => {
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
})

describe('assert.doesNotThrow', () => {
  it('passes when function does not throw', () => {
    assert.doesNotThrow(() => {})
  })

  it('throws AssertionError when function throws', () => {
    nodeAssert.throws(
      () => assert.doesNotThrow(() => { throw new Error('oops') }),
      assert.AssertionError,
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

  it('validates error constructor', async () => {
    await assert.rejects(() => Promise.reject(new TypeError('bad type')), TypeError)
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
})

// ---------------------------------------------------------------------------
// node:assert/strict compatibility — verifies that our errors match node's
// on the fields that matter: name, operator, actual, expected.
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
    let throwing = () => { throw new Error('oops') }
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
    nodeAssert.equal(ours.operator, nodes.operator)
    nodeAssert.deepEqual(ours.actual, nodes.actual)
    nodeAssert.deepEqual(ours.expected, nodes.expected)
  }
}
