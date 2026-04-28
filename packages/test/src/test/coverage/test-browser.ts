import * as assert from '@remix-run/assert'
import { describe, it } from '../../lib/framework.ts'
import { add, classify, greet } from './fixture.ts'

// Expected coverage for coverage-fixture.ts (same as the server/e2e fixture
// tests):
//
//   add             — 100% functions, statements, lines, branches
//   classify        — function covered, but only the `n > 0` branch is hit
//                     (the `n < 0` and `else` branches are uncovered)
//   uncalledFunction — 0% across the board (never imported)
//   greet           — function covered, but only the truthy `name` branch is hit
//                     (the fallback `Hello, stranger!` line is uncovered)

describe('browser coverage fixture', () => {
  it('exercises some but not all code paths in the browser', () => {
    assert.equal(add(2, 3), 5)
    assert.equal(add(-1, 1), 0)

    assert.equal(classify(42), 'positive')
    assert.equal(classify(1), 'positive')
    // deliberately NOT testing classify(-1) or classify(0)

    assert.equal(greet('World'), 'Hello, World!')
    // deliberately NOT testing greet() without an argument

    // deliberately NOT importing or calling uncalledFunction
  })
})
