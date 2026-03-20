import * as assert from '@remix-run/assert'
import {
  describe,
  it,
  suite,
  test,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from '@remix-run/test'

// During test execution, currentSuite is null so describe() can be called freely.
// captureRegistration() splices any newly-registered suites back out of __testSuites
// so the executor doesn't run them — we just inspect their shape.
function captureRegistration(fn: () => void): any[] {
  let suites = (globalThis as any).__testSuites as any[]
  let before = suites.length
  fn()
  return suites.splice(before)
}

// ── describe ──────────────────────────────────────────────────────────────────

describe('describe', () => {
  it('has skip, only, and todo sub-functions', () => {
    assert.equal(typeof describe.skip, 'function')
    assert.equal(typeof describe.only, 'function')
    assert.equal(typeof describe.todo, 'function')
  })

  it('registers a suite with the given name', () => {
    let [s] = captureRegistration(() => describe('my suite', () => {}))
    assert.equal(s.name, 'my suite')
  })

  it('calls fn to register tests', () => {
    let called = false
    captureRegistration(() =>
      describe('suite', () => {
        called = true
      }),
    )
    assert.equal(called, true)
  })

  it('registers tests added inside fn', () => {
    let [s] = captureRegistration(() =>
      describe('suite', () => {
        it('test one', () => {})
        it('test two', () => {})
      }),
    )
    assert.equal(s.tests.length, 2)
    assert.equal(s.tests[0].name, 'test one')
    assert.equal(s.tests[1].name, 'test two')
  })

  it('flattens nested describes into "Outer > Inner" names', () => {
    let [outer, inner] = captureRegistration(() => {
      describe('outer', () => {
        describe('inner', () => {})
      })
    })
    assert.equal(outer.name, 'outer')
    assert.equal(inner.name, 'outer > inner')
  })
})

describe('describe.skip', () => {
  it('marks the suite as skipped', () => {
    let [s] = captureRegistration(() => describe.skip('suite', () => {}))
    assert.equal(s.skip, true)
  })

  it('still calls fn to register tests', () => {
    let [s] = captureRegistration(() =>
      describe.skip('suite', () => {
        it('test', () => {})
      }),
    )
    assert.equal(s.tests.length, 1)
  })
})

describe('describe.only', () => {
  it('marks the suite as only', () => {
    let [s] = captureRegistration(() => describe.only('suite', () => {}))
    assert.equal(s.only, true)
  })
})

describe('describe.todo', () => {
  it('marks the suite as todo', () => {
    let [s] = captureRegistration(() => describe.todo('suite'))
    assert.equal(s.todo, true)
  })

  it('registers with no tests', () => {
    let [s] = captureRegistration(() => describe.todo('suite'))
    assert.equal(s.tests.length, 0)
  })
})

// ── it ────────────────────────────────────────────────────────────────────────

describe('it', () => {
  it('has skip, only, and todo sub-functions', () => {
    assert.equal(typeof it.skip, 'function')
    assert.equal(typeof it.only, 'function')
    assert.equal(typeof it.todo, 'function')
  })

  it('throws when called outside describe', () => {
    assert.throws(() => it('orphan', () => {}), /must be called inside describe/)
  })

  it('registers a test with the given name and fn', () => {
    let fn = () => {}
    let [s] = captureRegistration(() =>
      describe('suite', () => {
        it('my test', fn)
      }),
    )
    assert.equal(s.tests[0].name, 'my test')
    assert.equal(s.tests[0].fn, fn)
  })
})

describe('it.skip', () => {
  it('marks the test as skipped', () => {
    let [s] = captureRegistration(() =>
      describe('suite', () => {
        it.skip('skipped test', () => {})
      }),
    )
    assert.equal(s.tests[0].skip, true)
  })

  it('accepts an optional fn', () => {
    let [s] = captureRegistration(() =>
      describe('suite', () => {
        it.skip('no fn')
      }),
    )
    assert.equal(s.tests[0].skip, true)
    assert.equal(typeof s.tests[0].fn, 'function')
  })
})

describe('it.only', () => {
  it('marks the test as only', () => {
    let [s] = captureRegistration(() =>
      describe('suite', () => {
        it.only('only test', () => {})
      }),
    )
    assert.equal(s.tests[0].only, true)
  })
})

describe('it.todo', () => {
  it('marks the test as todo', () => {
    let [s] = captureRegistration(() =>
      describe('suite', () => {
        it.todo('todo test')
      }),
    )
    assert.equal(s.tests[0].todo, true)
    assert.equal(s.tests[0].name, 'todo test')
  })

  it('throws when called outside describe', () => {
    assert.throws(() => it.todo('orphan'), /must be called inside describe/)
  })
})

// ── Aliases ───────────────────────────────────────────────────────────────────

describe('suite', () => {
  it('is an alias for describe', () => {
    assert.equal(suite, describe)
  })
})

describe('test', () => {
  it('is an alias for it', () => {
    assert.equal(test, it)
  })
})

// ── Lifecycle hooks ───────────────────────────────────────────────────────────

describe('lifecycle hooks', () => {
  it('beforeEach registers on the current suite', () => {
    let fn = () => {}
    let [s] = captureRegistration(() =>
      describe('suite', () => {
        beforeEach(fn)
      }),
    )
    assert.equal(s.beforeEach, fn)
  })

  it('afterEach registers on the current suite', () => {
    let fn = () => {}
    let [s] = captureRegistration(() =>
      describe('suite', () => {
        afterEach(fn)
      }),
    )
    assert.equal(s.afterEach, fn)
  })

  it('beforeAll registers on the current suite', () => {
    let fn = () => {}
    let [s] = captureRegistration(() =>
      describe('suite', () => {
        beforeAll(fn)
      }),
    )
    assert.equal(s.beforeAll, fn)
  })

  it('afterAll registers on the current suite', () => {
    let fn = () => {}
    let [s] = captureRegistration(() =>
      describe('suite', () => {
        afterAll(fn)
      }),
    )
    assert.equal(s.afterAll, fn)
  })

  it('beforeEach can be called outside describe (registers on root hooks)', () => {
    // Just verify it doesn't throw — root-level hooks are tested via inheritance
    assert.doesNotThrow(() => {
      let [s] = captureRegistration(() => {
        beforeEach(() => {})
        describe('suite', () => {})
      })
      assert.equal(typeof s.beforeEach, 'function')
    })
  })

  it('afterEach can be called outside describe (registers on root hooks)', () => {
    assert.doesNotThrow(() => {
      let [s] = captureRegistration(() => {
        afterEach(() => {})
        describe('suite', () => {})
      })
      assert.equal(typeof s.afterEach, 'function')
    })
  })

  it('beforeAll can be called outside describe (registers on root hooks)', () => {
    assert.doesNotThrow(() => {
      let [s] = captureRegistration(() => {
        beforeAll(() => {})
        describe('suite', () => {})
      })
      assert.equal(typeof s.beforeAll, 'function')
    })
  })

  it('afterAll can be called outside describe (registers on root hooks)', () => {
    assert.doesNotThrow(() => {
      let [s] = captureRegistration(() => {
        afterAll(() => {})
        describe('suite', () => {})
      })
      assert.equal(typeof s.afterAll, 'function')
    })
  })
})

describe('Example Test Suite', () => {
  it('passes basic equality', () => {
    assert.equal(1 + 1, 2)
  })

  it('passes deep equality', () => {
    assert.deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })
  })

  it('can test async code', async () => {
    let result = await Promise.resolve(42)
    assert.equal(result, 42)
  })

  it('can assert throws', () => {
    assert.throws(() => {
      throw new Error('test error')
    }, /test error/)
  })

  it.skip('skip: can skip tests', () => {
    assert.equal(true, false)
  })

  it.todo('todo: can mark tests as todo')
})

describe.skip('skip: Skipped Test Suite', () => {
  it('would fail', () => {
    assert.equal(true, false)
  })
})

describe.todo('todo: Test Suite')
