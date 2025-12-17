import { describe, expect, it } from 'vitest'

import { parse } from './parse.ts'
import { variants } from './variants.ts'

describe('variants', () => {
  it('returns all possible combinations of optionals for a simple pathname', () => {
    let source = 'api/(v:major(.:minor)/)run'
    let ast = parse(source)
    let results = Array.from(variants(ast))
    expect(results).toEqual([
      {
        key: [[], [], [], ['api', 'run']],
        paramIndices: new Set([]),
      },
      {
        key: [[], [], [], ['api', 'v{:}', 'run']],
        paramIndices: new Set([0]),
      },
      {
        key: [[], [], [], ['api', 'v{:}.{:}', 'run']],
        paramIndices: new Set([0, 1]),
      },
    ])
  })

  it('returns variants for a full URL pattern', () => {
    let source = 'https://example.com/users/:id'
    let ast = parse(source)
    let results = Array.from(variants(ast))
    expect(results).toEqual([
      {
        key: [['https'], ['com', 'example'], [], ['users', '{:}']],
        paramIndices: new Set([0]),
      },
    ])
  })
})
