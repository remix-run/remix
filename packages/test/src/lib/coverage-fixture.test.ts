import * as assert from '@remix-run/assert'
import { describe, it } from './framework.ts'
import { add, classify, greet } from './coverage-fixture.ts'

// Expected coverage for coverage-fixture.ts:
//
//   add             — 100% functions, statements, lines, branches
//   classify        — function covered, but only the `n > 0` branch is hit
//                     (the `n < 0` and `else` branches are uncovered)
//   uncalledFunction — 0% across the board (never imported)
//   greet           — function covered, but only the truthy `name` branch is hit
//                     (the fallback `Hello, stranger!` line is uncovered)

describe('coverage-fixture', () => {
  it('add returns the sum', () => {
    assert.equal(add(2, 3), 5)
    assert.equal(add(-1, 1), 0)
  })

  it('classify identifies positive numbers only', () => {
    assert.equal(classify(42), 'positive')
    assert.equal(classify(1), 'positive')
    // deliberately NOT testing classify(-1) or classify(0)
  })

  // deliberately NOT importing or calling uncalledFunction

  it('greet with a name only', () => {
    assert.equal(greet('World'), 'Hello, World!')
    // deliberately NOT testing greet() without an argument
  })
})
