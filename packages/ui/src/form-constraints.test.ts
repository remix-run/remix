import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { boolean, literal, number, optional, string } from '@remix-run/data-schema'
import { email, max, maxLength, min, minLength, url } from '@remix-run/data-schema/checks'

import { getConstraints } from './form.ts'

describe('getConstraints', () => {
  it('returns native length and range constraints', () => {
    assert.deepEqual(getConstraints(string().pipe(minLength(2), maxLength(50)), { type: 'text' }), {
      required: true,
      minLength: 2,
      maxLength: 50,
    })
    assert.deepEqual(getConstraints(number().pipe(min(13), max(120)), { type: 'number' }), {
      required: true,
      step: 'any',
      min: 13,
      max: 120,
    })
  })

  it('derives requiredness from the input type', () => {
    assert.deepEqual(getConstraints(string(), { type: 'text' }), {
      required: true,
    })
    assert.deepEqual(getConstraints(optional(string()), { type: 'text' }), {})
    assert.deepEqual(getConstraints(boolean(), { type: 'checkbox' }), {})
    assert.deepEqual(getConstraints(literal(true), { type: 'checkbox' }), {
      required: true,
    })
  })

  it('preserves constraints through schema composition', () => {
    let schema = optional(string().pipe(minLength(2), maxLength(50)))
      .refine((value) => value !== 'admin')
      .transform((value) => value?.trim())

    assert.deepEqual(getConstraints(schema, { type: 'text' }), {
      minLength: 2,
      maxLength: 50,
    })
  })

  it('omits checks that do not map to native constraints', () => {
    assert.deepEqual(getConstraints(optional(string().pipe(email(), url())), { type: 'url' }), {})
  })
})
