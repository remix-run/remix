import * as nodeAssert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { AssertionError } from './assert.ts'
import { expect } from './expect.ts'

function captureSync(fn: () => void): unknown {
  try {
    fn()
    return null
  } catch (e) {
    return e
  }
}

async function captureAsync(fn: () => Promise<void>): Promise<unknown> {
  try {
    await fn()
    return null
  } catch (e) {
    return e
  }
}

function expectFails(fn: () => void) {
  let err = captureSync(fn)
  nodeAssert.ok(err instanceof AssertionError, `expected AssertionError, got ${err}`)
}

async function expectFailsAsync(fn: () => Promise<void>) {
  let err = await captureAsync(fn)
  nodeAssert.ok(err instanceof AssertionError, `expected AssertionError, got ${err}`)
}

describe('expect.toBe', () => {
  it('passes for strict equality', () => {
    expect(1).toBe(1)
    expect('a').toBe('a')
    expect(NaN).toBe(NaN) // Object.is
  })

  it('fails for non-equal values', () => {
    expectFails(() => expect(1).toBe(2))
    expectFails(() => expect({} as any).toBe({}))
  })

  it('supports .not', () => {
    expect(1).not.toBe(2)
    expectFails(() => expect(1).not.toBe(1))
  })
})

describe('expect.toEqual', () => {
  it('passes for deeply equal objects', () => {
    expect({ a: 1, b: [2, 3] }).toEqual({ a: 1, b: [2, 3] })
  })

  it('fails for type-coerced values', () => {
    expectFails(() => expect({ a: 1 }).toEqual({ a: '1' }))
  })

  it('fails for structurally unequal objects', () => {
    expectFails(() => expect({ a: 1 }).toEqual({ a: 2 }))
  })
})

describe('expect.toBeNull / toBeUndefined / toBeDefined / toBeTruthy', () => {
  it('toBeNull', () => {
    expect(null).toBeNull()
    expectFails(() => expect(undefined).toBeNull())
    expect(undefined).not.toBeNull()
  })

  it('toBeUndefined', () => {
    expect(undefined).toBeUndefined()
    expectFails(() => expect(null).toBeUndefined())
  })

  it('toBeDefined', () => {
    expect(0).toBeDefined()
    expectFails(() => expect(undefined).toBeDefined())
  })

  it('toBeTruthy', () => {
    expect(1).toBeTruthy()
    expect('hi').toBeTruthy()
    expectFails(() => expect(0).toBeTruthy())
    expectFails(() => expect('').toBeTruthy())
  })
})

describe('expect.toBeInstanceOf', () => {
  it('passes for instances', () => {
    expect(new Error('x')).toBeInstanceOf(Error)
    expect([]).toBeInstanceOf(Array)
  })

  it('fails for non-instances', () => {
    expectFails(() => expect({}).toBeInstanceOf(Error))
  })
})

describe('expect.toBeGreaterThan / toBeLessThan family', () => {
  it('numeric comparisons', () => {
    expect(2).toBeGreaterThan(1)
    expect(1).toBeGreaterThanOrEqual(1)
    expect(1).toBeLessThan(2)
    expect(1).toBeLessThanOrEqual(1)

    expectFails(() => expect(1).toBeGreaterThan(1))
    expectFails(() => expect(1).toBeLessThan(1))
  })
})

describe('expect.toBeCloseTo', () => {
  it('passes for values within precision', () => {
    expect(0.1 + 0.2).toBeCloseTo(0.3)
    expect(0.1 + 0.2).toBeCloseTo(0.3, 5)
  })

  it('fails for values outside precision', () => {
    expectFails(() => expect(1).toBeCloseTo(2))
  })
})

describe('expect.toContain', () => {
  it('strings', () => {
    expect('hello world').toContain('world')
    expectFails(() => expect('hello').toContain('foo'))
  })

  it('arrays', () => {
    expect([1, 2, 3]).toContain(2)
    expectFails(() => expect([1, 2]).toContain(3))
  })

  it('supports .not', () => {
    expect('hello').not.toContain('xyz')
  })
})

describe('expect.toMatch', () => {
  it('regex', () => {
    expect('hello').toMatch(/ell/)
    expectFails(() => expect('hello').toMatch(/foo/))
  })

  it('string', () => {
    expect('hello world').toMatch('world')
    expectFails(() => expect('hello').toMatch('foo'))
  })
})

describe('expect.toHaveLength', () => {
  it('arrays and strings', () => {
    expect([1, 2, 3]).toHaveLength(3)
    expect('abc').toHaveLength(3)
    expectFails(() => expect([1, 2]).toHaveLength(3))
  })
})

describe('expect.toHaveProperty', () => {
  it('checks property presence', () => {
    expect({ a: { b: 1 } }).toHaveProperty('a.b')
    expect({ a: 1 }).toHaveProperty('a')
    expectFails(() => expect({ a: 1 }).toHaveProperty('b'))
  })

  it('checks property value', () => {
    expect({ a: 1 }).toHaveProperty('a', 1)
    expectFails(() => expect({ a: 1 }).toHaveProperty('a', 2))
  })
})

describe('expect.toThrow', () => {
  it('passes when function throws', () => {
    expect(() => {
      throw new Error('oops')
    }).toThrow()
  })

  it('matches message string', () => {
    expect(() => {
      throw new Error('Render error!')
    }).toThrow('Render error!')
  })

  it('matches regex', () => {
    expect(() => {
      throw new Error('Render error!')
    }).toThrow(/render/i)
  })

  it('matches error class', () => {
    expect(() => {
      throw new TypeError('bad')
    }).toThrow(TypeError)
  })

  it('fails when function does not throw', () => {
    expectFails(() => expect(() => {}).toThrow())
  })

  it('fails when message does not match', () => {
    expectFails(() =>
      expect(() => {
        throw new Error('oops')
      }).toThrow('different'),
    )
  })
})

describe('expect mock matchers', () => {
  function createMockFn() {
    let calls: Array<{ arguments: unknown[] }> = []
    let fn = ((...args: unknown[]) => {
      calls.push({ arguments: args })
    }) as ((...args: unknown[]) => void) & { mock: { calls: typeof calls } }
    fn.mock = { calls }
    return fn
  }

  it('toHaveBeenCalled', () => {
    let fn = createMockFn()
    expect(fn).not.toHaveBeenCalled()
    fn(1)
    expect(fn).toHaveBeenCalled()
  })

  it('toHaveBeenCalledTimes', () => {
    let fn = createMockFn()
    fn(1)
    fn(2)
    expect(fn).toHaveBeenCalledTimes(2)
    expectFails(() => expect(fn).toHaveBeenCalledTimes(1))
  })

  it('toHaveBeenCalledWith', () => {
    let fn = createMockFn()
    fn('a', 1)
    expect(fn).toHaveBeenCalledWith('a', 1)
    expectFails(() => expect(fn).toHaveBeenCalledWith('a', 2))
  })

  it('toHaveBeenNthCalledWith', () => {
    let fn = createMockFn()
    fn('first')
    fn('second')
    expect(fn).toHaveBeenNthCalledWith(1, 'first')
    expect(fn).toHaveBeenNthCalledWith(2, 'second')
    expectFails(() => expect(fn).toHaveBeenNthCalledWith(2, 'first'))
  })

  it('throws when received is not a mock', () => {
    let err = captureSync(() => expect(() => {}).toHaveBeenCalled())
    nodeAssert.ok(err instanceof AssertionError)
  })
})

describe('expect.rejects / resolves', () => {
  it('rejects.toThrow with string', async () => {
    await expect(Promise.reject(new Error('Render error!'))).rejects.toThrow('Render error!')
  })

  it('rejects.toThrow with regex', async () => {
    await expect(Promise.reject(new Error('Render error!'))).rejects.toThrow(/render/i)
  })

  it('rejects.toThrow with error class', async () => {
    await expect(Promise.reject(new TypeError('x'))).rejects.toThrow(TypeError)
  })

  it('rejects.toThrow accepts a thunk returning a rejecting promise', async () => {
    await expect(() => Promise.reject(new Error('boom'))).rejects.toThrow('boom')
  })

  it('rejects fails when promise resolves', async () => {
    await expectFailsAsync(() => expect(Promise.resolve()).rejects.toThrow())
  })

  it('resolves.toBeUndefined', async () => {
    await expect(Promise.resolve(undefined)).resolves.toBeUndefined()
  })

  it('resolves fails when promise rejects', async () => {
    await expectFailsAsync(() => expect(Promise.reject(new Error('x'))).resolves.toBeUndefined())
  })

  it('resolves.toBe', async () => {
    await expect(Promise.resolve(42)).resolves.toBe(42)
    await expectFailsAsync(() => expect(Promise.resolve(42)).resolves.toBe(43))
  })
})
