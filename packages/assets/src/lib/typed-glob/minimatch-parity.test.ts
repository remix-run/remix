import assert from 'node:assert/strict'
import { test } from 'node:test'
import { minimatch } from 'minimatch'
import { globParityCases } from './parity-cases.ts'

for (let parityCase of globParityCases) {
  test(`minimatch parity: ${parityCase.name}`, () => {
    let options = 'options' in parityCase ? parityCase.options : {}
    let actual = minimatch(parityCase.path, parityCase.pattern, options)
    assert.equal(actual, parityCase.expected)
  })
}
