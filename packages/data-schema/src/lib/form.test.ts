import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import * as s from '../index.ts'
import * as fd from '../form.ts'
import { min, minLength } from '../checks.ts'
import * as legacy from '../form-data.ts'

describe('form schemas', () => {
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

  it('preserves passwords, whitespace, transforms, throwing parser identity, and typed entries', () => {
    let calls = 0
    let Signup = fd.object({
      password: fd.password(s.string().pipe(minLength(8))),
      name: fd.text(
        s.string().transform((value) => {
          calls++
          return value.length
        }),
      ),
      blank: fd.text(s.string(), { empty: 'preserve' }),
    })
    let data = new URLSearchParams({ password: '  secret  ', name: ' Ada ', blank: '' })
    let value: { password: string; name: number; blank: string } = s.parse(Signup, data)
    assert.deepEqual(value, { password: '  secret  ', name: 5, blank: '' })
    assert.equal(calls, 1)
    assert.equal(fd.parse, s.parse)
    assert.equal(Signup.entries.password.formKind, 'password')
    assert.equal(Object.isFrozen(Signup.entries), true)
    assert.equal(Object.isFrozen(Signup.entries.password), true)
  })

  it('keeps logical paths, shared error maps, and explicit message precedence', () => {
    let Signup = fd.object({
      age: fd.number(s.number().pipe(min(18)), {
        name: 'person.age',
        errorMap({ code }) {
          return code === 'number.min' ? 'Adults only' : undefined
        },
      }),
      name: fd.text(
        s.string().refine(() => false, 'Specific message'),
        {
          errorMap() {
            return 'Replacement'
          },
        },
      ),
    })
    let result = fd.parseSafe(Signup, new URLSearchParams({ 'person.age': '12', name: 'Ada' }))
    if (result.success) throw new Error('Expected failure')
    assert.deepEqual(
      result.issues.map(({ message, path }) => ({ message, path })),
      [
        { message: 'Adults only', path: ['age'] },
        { message: 'Specific message', path: ['name'] },
      ],
    )
    let early = fd.parseSafe(Signup, new URLSearchParams(), { abortEarly: true })
    if (early.success) throw new Error('Expected failure')
    assert.equal(early.issues.length, 1)
  })

  it('reuses repeated and file extraction without changing legacy empty strings', () => {
    let data = new FormData()
    data.set('name', '')
    data.append('tags', 'one')
    data.append('tags', 'two')
    data.set('upload', new File(['contents'], 'test.txt'))
    let Schema = fd.object({
      tags: fd.fields(s.array(s.string())),
      upload: fd.file(s.instanceof_(Blob)),
    })
    let result = fd.parse(Schema, data)
    assert.deepEqual(result.tags, ['one', 'two'])
    assert.equal(result.upload.size, 8)
    assert.deepEqual(s.parse(legacy.object({ name: legacy.field(s.string()) }), data), { name: '' })
    assert.equal(fd.parseSafe(fd.object({ name: fd.text(s.string()) }), data).success, false)
    data.set('name', new File(['bad'], 'name.txt'))
    assert.equal(fd.parseSafe(fd.object({ name: fd.text(s.string()) }), data).success, false)
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

  it('does not replace invalid numeric input with defaults or treat unchecked boxes as missing', () => {
    let Schema = fd.object({
      age: fd.number(s.defaulted(s.number(), 18)),
      subscribed: fd.checkbox(s.defaulted(s.boolean(), true)),
    })
    assert.deepEqual(fd.parse(Schema, new FormData()), { age: 18, subscribed: false })
    assert.equal(fd.parseSafe(Schema, new URLSearchParams({ age: 'invalid' })).success, false)
    assert.equal(fd.parseSafe(Schema, new URLSearchParams({ age: 'Infinity' })).success, false)
    assert.deepEqual(fd.parse(Schema, new URLSearchParams({ age: ' 0 ' })), {
      age: 0,
      subscribed: false,
    })
  })
})
