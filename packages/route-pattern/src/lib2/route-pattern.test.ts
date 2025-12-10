import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parse } from './route-pattern.ts'

describe('parse', () => {
  it('parses a simple pathname', () => {
    let ast = parse('users/:id')
    assert.deepEqual(ast, {
      protocol: undefined,
      hostname: undefined,
      port: undefined,
      pathname: {
        tokens: [
          { type: 'text', text: 'users/' },
          { type: ':', nameIndex: 0 },
        ],
        paramNames: ['id'],
        optionals: new Map(),
      },
      search: undefined,
    })
  })

  it('parses a full URL pattern', () => {
    let ast = parse('https://example.com/users/:id')
    assert.deepEqual(ast, {
      protocol: {
        tokens: [{ type: 'text', text: 'https' }],
        paramNames: [],
        optionals: new Map(),
      },
      hostname: {
        tokens: [{ type: 'text', text: 'example.com' }],
        paramNames: [],
        optionals: new Map(),
      },
      port: undefined,
      pathname: {
        tokens: [
          { type: 'text', text: 'users/' },
          { type: ':', nameIndex: 0 },
        ],
        paramNames: ['id'],
        optionals: new Map(),
      },
      search: undefined,
    })
  })

  it('parses protocol and pathname without hostname', () => {
    let ast = parse('file:///path/to/file')
    assert.deepEqual(ast, {
      protocol: {
        tokens: [{ type: 'text', text: 'file' }],
        paramNames: [],
        optionals: new Map(),
      },
      hostname: undefined,
      port: undefined,
      pathname: {
        tokens: [{ type: 'text', text: 'path/to/file' }],
        paramNames: [],
        optionals: new Map(),
      },
      search: undefined,
    })
  })
})
