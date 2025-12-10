import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parse } from './parse.ts'
import { variants } from './variants.ts'

describe('variants', () => {
  it('returns all possible combinations of optionals', () => {
    let source = 'api/(v:major(.:minor)/)run'
    let ast = parse(source)
    assert.deepEqual(variants(ast), ['api/run', 'api/v{:0}/run', 'api/v{:0}.{:1}/run'])
  })
})
