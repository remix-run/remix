import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import * as s from '../index.ts'
import * as fd from '../experimental-form.ts'
import { min, minLength } from '../checks.ts'
import * as legacy from '../form-data.ts'

describe('form schemas', () => {
  it('normalizes empty browser uploads without dropping named empty files or changing lower-level extraction', () => {
    let single = fd.file(s.optional(s.instanceof_(Blob)))
    let multiple = fd.files(s.array(s.instanceof_(Blob)))
    let schema = fd.object({ single, multiple })
    let data = new FormData()
    let absent = new File([], '')
    data.set('single', absent)
    data.append('multiple', absent)
    assert.deepEqual(fd.parse(schema, data), { single: undefined, multiple: [] })
    let named = new File([], 'empty.txt')
    data.set('single', named)
    data.append('multiple', named)
    assert.deepEqual(fd.parse(schema, data), { single: named, multiple: [named] })
    let legacySchema = legacy.object({ single, multiple })
    assert.deepEqual(s.parse(legacySchema, data), { single: named, multiple: [absent, named] })
  })
  it('normalizes form values before ordinary optional/defaulted validation', () => {
    let Signup = fd.object({
      nickname: fd.text(s.optional(s.string())),
      name: fd.text(s.defaulted(s.string(), 'Anonymous')),
      age: fd.number(s.optional(s.number().pipe(min(0)))),
      subscribed: fd.checkbox(),
      terms: fd.checkbox(s.literal(true)),
    })
    let data = new FormData()
    data.set('nickname', '')
    data.set('name', '')
    data.set('age', '  ')
    data.set('terms', 'false')
    assert.deepEqual(fd.parse(Signup, data), {
      nickname: undefined,
      name: 'Anonymous',
      age: undefined,
      subscribed: false,
      terms: true,
    })
    let Defaults = fd.object({
      age: fd.number(s.defaulted(s.number(), 18)),
      subscribed: fd.checkbox(s.defaulted(s.boolean(), true)),
    })
    assert.deepEqual(fd.parse(Defaults, new FormData()), { age: 18, subscribed: false })
    assert.equal(fd.parseSafe(Defaults, new URLSearchParams({ age: 'invalid' })).success, false)
    data.set('age', '0')
    assert.equal(fd.parse(Signup, data).age, 0)
    data.set('age', 'invalid')
    assert.equal(fd.parseSafe(Signup, data).success, false)
    data.delete('terms')
    let failure = fd.parseSafe(Signup, data)
    assert.equal(failure.success, false)
    if (failure.success) throw new Error('Expected failure')
    assert.deepEqual(
      failure.issues.map((issue) => issue.path),
      [['age'], ['terms']],
    )
  })

  it('preserves text and password whitespace and explicitly empty values', () => {
    let Signup = fd.object({
      password: fd.password(s.string().pipe(minLength(8))),
      name: fd.text(s.string()),
      blank: fd.text(s.string(), { empty: 'preserve' }),
    })
    let data = new URLSearchParams({ password: '  secret  ', name: ' Ada ', blank: '' })
    assert.deepEqual(fd.parse(Signup, data), { password: '  secret  ', name: ' Ada ', blank: '' })
  })

  it('maps descriptor errors using logical paths rather than submitted names', () => {
    let Signup = fd.object({
      age: fd.number(s.number().pipe(min(18)), {
        name: 'person.age',
        errorMap({ code }) {
          return code === 'number.min' ? 'Adults only' : undefined
        },
      }),
    })
    let result = fd.parseSafe(Signup, new URLSearchParams({ 'person.age': '12' }))
    if (result.success) throw new Error('Expected failure')
    assert.deepEqual(
      result.issues.map(({ message, path }) => ({ message, path })),
      [{ message: 'Adults only', path: ['age'] }],
    )
  })

  it('does not evaluate defaults during metadata inspection or accept mutated descriptors', () => {
    let calls = 0
    let descriptor = fd.text(
      s.defaulted(s.string(), () => {
        calls++
        return 'fallback'
      }),
    )
    let entries = { name: descriptor }
    let Schema = fd.object(entries)
    entries.name = fd.text(s.string())
    assert.equal(calls, 0)
    assert.deepEqual(fd.parse(Schema, new FormData()), { name: 'fallback' })
    assert.equal(calls, 1)
    assert.equal(Schema.entries.name, descriptor)
    assert.equal(Reflect.set(Schema, 'entries', {}), false)
  })
})
