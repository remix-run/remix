import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as s from '../index.ts'
import * as fd from '../form.ts'
import { max, maxLength, min, minLength } from '../checks.ts'

const User = s.object({
  id: s.string(),
  name: s.string().pipe(minLength(2), maxLength(50)),
  age: s.number().pipe(min(13), max(120)),
})
const Profile = fd.object({
  name: fd.text(User.shape.name),
  age: fd.number(User.shape.age),
  bio: fd.text(s.optional(s.string())),
  password: fd.password(s.string()),
  terms: fd.checkbox(s.literal(true)),
})

describe('form parseSafe', () => {
  it('reuses model rules, includes ancillary fields, and returns only configured validated values', () => {
    let result = fd.parseSafe(
      Profile,
      new URLSearchParams({
        name: 'Ada',
        age: '37',
        password: 'secret',
        terms: 'on',
        id: 'untrusted',
      }),
    )
    assert.equal(result.success, true)
    if (!result.success) throw new Error('Expected success')
    assert.deepEqual(result.value, {
      name: 'Ada',
      age: 37,
      bio: undefined,
      password: 'secret',
      terms: true,
    })
  })

  it('restores raw number text and checkbox states while omitting every password value', () => {
    let data = new URLSearchParams({
      name: 'A',
      age: ' 0012 ',
      password: 'private-secret',
      bio: 'raw bio',
    })
    let result = fd.parseSafe(Profile, data)
    assert.equal(result.success, false)
    if (result.success) throw new Error('Expected failure')
    assert.deepEqual(result.values, { name: 'A', age: ' 0012 ', bio: 'raw bio', terms: false })
    assert.deepEqual(Object.keys(result.errors.fields), ['name', 'age', 'terms'])
    assert.equal(JSON.stringify(result).includes('private-secret'), false)
    assert.equal(Object.hasOwn(result.errors, 'form'), false)
    data.set('password', '')
    let passwordFailure = fd.parseSafe(Profile, data)
    if (passwordFailure.success) throw new Error('Expected failure')
    assert.equal(Object.hasOwn(passwordFailure.errors.fields, 'password'), true)
    assert.equal(Object.hasOwn(passwordFailure.values, 'password'), false)
  })

  it('projects arbitrary issue metadata and logical paths into safe serializable failures', () => {
    let secretSchema = s.createSchema<unknown, string>(() => ({
      issues: [
        { message: 'Invalid password', path: [{ key: 'password' }], input: 'private-secret' },
      ],
    }))
    let schema = fd.object({
      password: fd.password(secretSchema),
      name: fd.text(s.string(), { name: 'user.name' }),
    })
    let result = fd.parseSafe(
      schema,
      new URLSearchParams({ password: 'private-secret', 'user.name': '' }),
    )
    if (result.success) throw new Error('Expected failure')
    assert.equal(JSON.stringify(result).includes('private-secret'), false)
    assert.deepEqual(result.issues[0], { message: 'Invalid password', path: ['password'] })
    assert.deepEqual(result.values, { name: '' })
    assert.equal(Object.hasOwn(result.errors.fields, 'name'), true)
  })

  it('retains repeated raw text and omits files on failures', () => {
    let schema = fd.object({
      name: fd.text(s.string()),
      tags: fd.fields(s.array(s.string())),
      upload: fd.file(s.instanceof_(Blob)),
    })
    let data = new FormData()
    data.append('tags', 'one')
    data.append('tags', 'two')
    data.set('upload', new File(['secret file contents'], 'file.txt'))
    let result = fd.parseSafe(schema, data)
    if (result.success) throw new Error('Expected failure')
    assert.deepEqual(result.values, { tags: ['one', 'two'] })
    assert.equal(JSON.stringify(result).includes('secret file contents'), false)
  })

  it('handles reserved logical keys and does not execute default factories during inspection', () => {
    let calls = 0
    let schema = fd.object({
      toString: fd.text(s.string()),
      age: fd.number(
        s.defaulted(s.number(), () => {
          calls++
          return 18
        }),
      ),
    })
    assert.equal(calls, 0)
    let result = fd.parseSafe(schema, new URLSearchParams({ toString: 'value' }))
    if (!result.success) throw new Error('Expected success')
    assert.deepEqual(result.value, { toString: 'value', age: 18 })
    assert.equal(calls, 1)
  })
})

describe('form schema parsing methods', () => {
  it('shares typed transformed success output and parses once per call', () => {
    let calls = 0
    let Signup = fd.object({
      name: fd.text(
        s.string().transform((value) => {
          calls++
          return value.length
        }),
      ),
    })
    let data = new FormData()
    data.set('name', 'Ada')
    let { parse, parseSafe } = Signup
    let value: { readonly name: number } = parse(data)
    assert.deepEqual(value, { name: 3 })
    assert.equal(calls, 1)
    let result: fd.FormParseResult<{ readonly name: number }> = parseSafe(data)
    assert.deepEqual(result, { success: true, value: { name: 3 } })
    assert.equal(calls, 2)
    assert.deepEqual(fd.parseSafe(Signup, data), result)
    assert.equal(calls, 3)
  })

  it('keeps throwing parsing and core safe parsing contracts unchanged', () => {
    let Signup = fd.object({
      password: fd.password(
        s.createSchema<unknown, string>((value) => ({
          issues: [{ message: 'Invalid password', path: ['password'], input: value }],
        })),
      ),
    })
    let data = new URLSearchParams({ password: 'private-secret' })
    assert.throws(() => Signup.parse(data), fd.ValidationError)
    let ordinary = s.parseSafe(Signup, data)
    if (ordinary.success) throw new Error('Expected failure')
    assert.equal('values' in ordinary, false)
    assert.equal(JSON.stringify(ordinary).includes('private-secret'), true)
    let submission = Signup.parseSafe(data)
    if (submission.success) throw new Error('Expected failure')
    assert.deepEqual(submission.values, {})
    assert.equal(JSON.stringify(submission).includes('private-secret'), false)
    assert.deepEqual(submission, fd.parseSafe(Signup, data))
  })

  it('forwards parsing options and restores raw values independently of abortEarly', () => {
    let calls = 0
    let Signup = fd.object({
      name: fd.text(
        s.string().refine(() => {
          calls++
          return false
        }),
      ),
      age: fd.number(s.number()),
      password: fd.password(s.string()),
    })
    let result = Signup.parseSafe(
      new URLSearchParams({
        name: 'Ada',
        age: 'invalid',
        password: 'private-secret',
      }),
      {
        abortEarly: true,
        errorMap() {
          return 'Try again'
        },
      },
    )
    if (result.success) throw new Error('Expected failure')
    assert.equal(calls, 1)
    assert.deepEqual(result.issues, [{ message: 'Try again', path: ['name'] }])
    assert.deepEqual(result.values, { name: 'Ada', age: 'invalid' })
    assert.deepEqual(result.errors, { fields: { name: ['Try again'] } })
    try {
      Signup.parse(new URLSearchParams({ name: 'Ada' }), {
        errorMap() {
          return 'Throwing message'
        },
      })
      assert.fail('Expected a validation error')
    } catch (error) {
      assert.ok(error instanceof fd.ValidationError)
      assert.equal(error.issues[0].message, 'Throwing message')
    }
  })

  it('returns a grouped failure for invalid source input instead of attempting restoration', () => {
    let Signup = fd.object({ email: fd.text(s.string()) })
    let result = Signup.parseSafe({ email: 'untrusted' })
    if (result.success) throw new Error('Expected failure')
    assert.deepEqual(result.values, {})
    assert.deepEqual(result.errors.fields, {})
    assert.deepEqual(result.errors.form, ['Expected FormData or URLSearchParams'])
    assert.deepEqual(result.issues, [{ message: 'Expected FormData or URLSearchParams' }])
  })
})
