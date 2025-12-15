import { describe, expect, it } from 'vitest'

import { parse } from './parse.ts'
import { variants } from './variants.ts'

describe('variants', () => {
  it('returns all possible combinations of optionals', () => {
    let source = 'api/(v:major(.:minor)/)run'
    let ast = parse(source)
    expect(variants(ast)).toEqual([
      { key: 'api/run', paramNames: [] },
      { key: 'api/v{:}/run', paramNames: ['major'] },
      { key: 'api/v{:}.{:}/run', paramNames: ['major', 'minor'] },
    ])
  })
})
