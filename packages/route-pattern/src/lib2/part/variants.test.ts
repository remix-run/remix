import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parse } from './parse.ts'
import { variants } from './variants.ts'

describe('variants', () => {
  it('returns all possible combinations of optionals', () => {
    let source = 'api/(v:major(.:minor)/)run'
    let ast = parse(source)
    assert.deepEqual(variants(ast), [
      { key: 'api/run', paramIndices: [] },
      { key: 'api/v{:}/run', paramIndices: [0] },
      { key: 'api/v{:}.{:}/run', paramIndices: [0, 1] },
    ])
  })
})
