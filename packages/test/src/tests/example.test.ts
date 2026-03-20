import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

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

  it.skip('can skip tests', () => {
    assert.equal(true, false)
  })

  it.todo('can mark tests as todo')
})

describe.skip('Skipped Test Suite', () => {
  it('would fail', () => {
    assert.equal(true, false)
  })
})

describe.todo('TODO Test Suite')
