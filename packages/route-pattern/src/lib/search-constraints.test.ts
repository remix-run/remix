import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseSearchConstraints } from './search-constraints.ts'

describe('parseSearchConstraints', () => {
  it('parses empty search string', () => {
    assert.deepEqual(parseSearchConstraints(''), new Map())
  })

  describe('single parameter constraints', () => {
    it('parses bare parameter (presence only)', () => {
      assert.deepEqual(
        parseSearchConstraints('debug'),
        new Map([
          [
            'debug',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
        ]),
      )
    })

    it('parses parameter with empty value', () => {
      assert.deepEqual(
        parseSearchConstraints('q='),
        new Map([
          [
            'q',
            {
              allowBare: false,
              requireAssignment: true,
              // Note: empty values don't create requiredValues set
            },
          ],
        ]),
      )
    })

    it('parses parameter with specific value', () => {
      assert.deepEqual(
        parseSearchConstraints('format=json'),
        new Map([
          [
            'format',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['json']),
            },
          ],
        ]),
      )
    })

    it('parses parameter with URL-encoded value', () => {
      assert.deepEqual(
        parseSearchConstraints('q=hello%20world'),
        new Map([
          [
            'q',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['hello world']),
            },
          ],
        ]),
      )
    })

    it('parses parameter with plus-encoded spaces', () => {
      assert.deepEqual(
        parseSearchConstraints('q=hello+world'),
        new Map([
          [
            'q',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['hello world']),
            },
          ],
        ]),
      )
    })

    it('parses parameter with special characters', () => {
      assert.deepEqual(
        parseSearchConstraints('data=test%26more%3Dvalue'),
        new Map([
          [
            'data',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['test&more=value']),
            },
          ],
        ]),
      )
    })

    it('parses parameter with URL-encoded name', () => {
      assert.deepEqual(
        parseSearchConstraints('my%20param=value'),
        new Map([
          [
            'my param',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['value']),
            },
          ],
        ]),
      )
    })
  })

  describe('multiple parameter constraints', () => {
    it('parses multiple bare parameters', () => {
      assert.deepEqual(
        parseSearchConstraints('debug&verbose'),
        new Map([
          [
            'debug',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
          [
            'verbose',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
        ]),
      )
    })

    it('parses multiple parameters with values', () => {
      assert.deepEqual(
        parseSearchConstraints('format=json&version=v1'),
        new Map([
          [
            'format',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['json']),
            },
          ],
          [
            'version',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['v1']),
            },
          ],
        ]),
      )
    })

    it('parses mixed bare and assigned parameters', () => {
      assert.deepEqual(
        parseSearchConstraints('debug&format=json&verbose'),
        new Map([
          [
            'debug',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
          [
            'format',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['json']),
            },
          ],
          [
            'verbose',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
        ]),
      )
    })

    it('parses complex parameter combination', () => {
      assert.deepEqual(
        parseSearchConstraints('page=1&limit=10&sort=date&debug'),
        new Map([
          [
            'page',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['1']),
            },
          ],
          [
            'limit',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['10']),
            },
          ],
          [
            'sort',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['date']),
            },
          ],
          [
            'debug',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
        ]),
      )
    })
  })

  describe('repeated parameter constraints', () => {
    it('parses repeated parameter with same value', () => {
      assert.deepEqual(
        parseSearchConstraints('tags=javascript&tags=javascript'),
        new Map([
          [
            'tags',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['javascript']),
            },
          ],
        ]),
      )
    })

    it('parses repeated parameter with different values', () => {
      assert.deepEqual(
        parseSearchConstraints('tags=javascript&tags=react'),
        new Map([
          [
            'tags',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['javascript', 'react']),
            },
          ],
        ]),
      )
    })

    it('parses repeated parameter with multiple different values', () => {
      assert.deepEqual(
        parseSearchConstraints('tags=javascript&tags=react&tags=typescript'),
        new Map([
          [
            'tags',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['javascript', 'react', 'typescript']),
            },
          ],
        ]),
      )
    })

    it('parses repeated bare parameter', () => {
      assert.deepEqual(
        parseSearchConstraints('debug&debug'),
        new Map([
          [
            'debug',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
        ]),
      )
    })

    it('parses mixed bare and assigned for same parameter', () => {
      assert.deepEqual(
        parseSearchConstraints('mode&mode=development'),
        new Map([
          [
            'mode',
            {
              allowBare: false, // becomes false when assignment is seen
              requireAssignment: true, // becomes true when assignment is seen
              requiredValues: new Set(['development']),
            },
          ],
        ]),
      )
    })

    it('parses assigned then bare for same parameter', () => {
      assert.deepEqual(
        parseSearchConstraints('mode=development&mode'),
        new Map([
          [
            'mode',
            {
              allowBare: false, // stays false once assignment is seen
              requireAssignment: true, // stays true once assignment is seen
              requiredValues: new Set(['development']),
            },
          ],
        ]),
      )
    })
  })

  describe('edge cases', () => {
    it('handles empty parameter names', () => {
      assert.deepEqual(
        parseSearchConstraints('=value'),
        new Map([
          [
            '',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['value']),
            },
          ],
        ]),
      )
    })

    it('handles empty parameter segments', () => {
      assert.deepEqual(
        parseSearchConstraints('a=1&&b=2'),
        new Map([
          [
            'a',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['1']),
            },
          ],
          [
            'b',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['2']),
            },
          ],
        ]),
      )
    })

    it('handles trailing ampersand', () => {
      assert.deepEqual(
        parseSearchConstraints('debug&'),
        new Map([
          [
            'debug',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
        ]),
      )
    })

    it('handles leading ampersand', () => {
      assert.deepEqual(
        parseSearchConstraints('&debug'),
        new Map([
          [
            'debug',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
        ]),
      )
    })

    it('handles multiple consecutive ampersands', () => {
      assert.deepEqual(
        parseSearchConstraints('debug&&&verbose'),
        new Map([
          [
            'debug',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
          [
            'verbose',
            {
              allowBare: true,
              requireAssignment: false,
            },
          ],
        ]),
      )
    })

    it('handles parameter with multiple equals signs', () => {
      assert.deepEqual(
        parseSearchConstraints('equation=x=y+z'),
        new Map([
          [
            'equation',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['x=y z']), // + is decoded to space
            },
          ],
        ]),
      )
    })

    it('handles complex URL encoding scenarios', () => {
      assert.deepEqual(
        parseSearchConstraints('redirect=%2Fhome%3Fuser%3D123%26tab%3Dsettings'),
        new Map([
          [
            'redirect',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['/home?user=123&tab=settings']),
            },
          ],
        ]),
      )
    })
  })

  describe('copied from parse.test.ts', () => {
    it('parses pathname with leading slash and search', () => {
      let constraints = parseSearchConstraints('q=1')
      assert.deepEqual(
        constraints,
        new Map([
          [
            'q',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['1']),
            },
          ],
        ]),
      )
    })

    it('parses with search params', () => {
      let constraints = parseSearchConstraints('q=:query')
      assert.deepEqual(
        constraints,
        new Map([
          [
            'q',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set([':query']),
            },
          ],
        ]),
      )
    })

    it('parses complex full URL search', () => {
      let constraints = parseSearchConstraints('format=json')
      assert.deepEqual(
        constraints,
        new Map([
          [
            'format',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['json']),
            },
          ],
        ]),
      )
    })
  })
})
