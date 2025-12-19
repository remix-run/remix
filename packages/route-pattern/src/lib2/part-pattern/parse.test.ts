import { describe, expect, it } from 'vitest'

import { parse } from './parse.ts'

describe('parse', () => {
  it('creates an AST', () => {
    expect(parse('api/(v:major(.:minor)/)run')).toEqual({
      tokens: [
        { type: 'text', text: 'api/' },
        { type: '(' },
        { type: 'text', text: 'v' },
        { type: ':', nameIndex: 0 },
        { type: '(' },
        { type: 'text', text: '.' },
        { type: ':', nameIndex: 1 },
        { type: ')' },
        { type: 'text', text: '/' },
        { type: ')' },
        { type: 'text', text: 'run' },
      ],
      paramNames: ['major', 'minor'],
      optionals: new Map([
        [1, 9],
        [4, 7],
      ]),
    })
  })
})
