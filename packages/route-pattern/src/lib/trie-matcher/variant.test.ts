import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PartPattern } from '../route-pattern/part-pattern.ts'
import { PartPatternVariant } from './variant.ts'

describe('Variant', () => {
  describe('generate', () => {
    function assertVariants(source: string, expected: Array<string>) {
      let pattern = PartPattern.parse(source, { type: 'pathname' })
      let actual = PartPatternVariant.generate(pattern).map((variant) =>
        variant.toString(pattern.separator),
      )
      assert.deepEqual(actual, expected)
    }

    it('produces all possible combinations of optionals', () => {
      assertVariants('a.:b.c', ['a.{:b}.c'])
      assertVariants('a(:b)*c', ['a{*c}', 'a{:b}{*c}'])
      assertVariants('a(:b)c(*d)e', ['ace', 'ac{*d}e', 'a{:b}ce', 'a{:b}c{*d}e'])
      assertVariants('a(:b(*c):d)e', ['ae', 'a{:b}{:d}e', 'a{:b}{*c}{:d}e'])
      assertVariants('a(:b(*c):d)e(*f)g', [
        'aeg',
        'ae{*f}g',
        'a{:b}{:d}eg',
        'a{:b}{:d}e{*f}g',
        'a{:b}{*c}{:d}eg',
        'a{:b}{*c}{:d}e{*f}g',
      ])
    })
  })
})
