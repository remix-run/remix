import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as s from '../index.ts'
import * as fd from '@remix-run/data-schema/experimental/form'
import { getSchemaMetadata } from '../experimental.ts'
import { max, maxLength, min, minLength } from '../checks.ts'

const User = s.object({
  id: s.string(),
  name: s.string().pipe(minLength(2), maxLength(50)),
  age: s.number().pipe(min(13), max(120)),
})
const Profile = fd.object({
  name: fd.text(getSchemaMetadata(User).shape.name),
  age: fd.number(getSchemaMetadata(User).shape.age),
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

  it('omits sensitive text from failures while returning validated values on success', () => {
    let Payment = fd.object({
      cardNumber: fd.text(s.string().pipe(minLength(20)), {
        name: 'payment.card',
        sensitive: true,
      }),
      cardholder: fd.text(s.string().pipe(minLength(2))),
      password: fd.password(s.string(), { sensitive: false }),
    })
    let data = new FormData()
    data.set('payment.card', 'private-card')
    data.set('cardholder', 'A')
    data.set('password', 'private-password')
    let failure = fd.parseSafe(Payment, data)
    if (failure.success) throw new Error('Expected failure')
    assert.deepEqual(failure.values, { cardholder: 'A' })
    assert.deepEqual(Object.keys(failure.errors.fields), ['cardNumber', 'cardholder'])
    assert.equal(JSON.stringify(failure).includes('private-card'), false)
    assert.equal(JSON.stringify(failure).includes('private-password'), false)
    data.set('payment.card', '12345678901234567890')
    data.set('cardholder', 'Ada')
    let value = {
      cardNumber: '12345678901234567890',
      cardholder: 'Ada',
      password: 'private-password',
    }
    assert.deepEqual(fd.parseSafe(Payment, data), { success: true, value })
    assert.deepEqual(fd.parse(Payment, data), value)
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
    data.set('name', 'Ada')
    let value = fd.parse(schema, data)
    assert.deepEqual(value.tags, ['one', 'two'])
    assert.equal(value.upload.size, 20)
  })
})

describe('form parsing', () => {
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
    assert.equal('parse' in Signup, false)
    assert.equal('parseSafe' in Signup, false)
    let value: { readonly name: number } = fd.parse(Signup, data)
    assert.deepEqual(value, { name: 3 })
    assert.equal(calls, 1)
    let result: fd.FormParseResult<{ readonly name: number }> = fd.parseSafe(Signup, data)
    assert.deepEqual(result, { success: true, value: { name: 3 } })
    assert.equal(calls, 2)
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
    assert.throws(() => fd.parse(Signup, data), fd.ValidationError)
    let ordinary = s.parseSafe(Signup, data)
    if (ordinary.success) throw new Error('Expected failure')
    assert.equal('values' in ordinary, false)
    assert.equal(JSON.stringify(ordinary).includes('private-secret'), true)
    let submission = fd.parseSafe(Signup, data)
    if (submission.success) throw new Error('Expected failure')
    assert.deepEqual(submission.values, {})
    assert.equal(JSON.stringify(submission).includes('private-secret'), false)
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
    let result = fd.parseSafe(
      Signup,
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
  })

  it('returns a grouped failure for invalid source input instead of attempting restoration', () => {
    let Signup = fd.object({ email: fd.text(s.string()) })
    let result = fd.parseSafe(Signup, { email: 'untrusted' })
    if (result.success) throw new Error('Expected failure')
    assert.deepEqual(result.values, {})
    assert.deepEqual(result.errors.fields, {})
    assert.deepEqual(result.errors.form, ['Expected FormData or URLSearchParams'])
    assert.deepEqual(result.issues, [{ message: 'Expected FormData or URLSearchParams' }])
    let data = new FormData()
    data.set('email', new File(['bad'], 'email.txt'))
    assert.equal(fd.parseSafe(Signup, data).success, false)
  })
})

describe('form submissionSchema', () => {
  it('roundtrips failed submissions through JSON with raw values and grouped errors', () => {
    let failure = fd.parseSafe(
      Profile,
      new URLSearchParams({ name: 'A', age: ' 0012 ', password: 'private-secret', bio: '' }),
    )
    if (failure.success) throw new Error('Expected failure')

    let Submission = Profile.submissionSchema
    assert.equal(Profile.submissionSchema, Submission)
    let restored: fd.FormSubmission = s.parse(Submission, JSON.parse(JSON.stringify(failure)))
    assert.deepEqual(restored, { values: failure.values, errors: failure.errors })
    assert.deepEqual(restored.values, { name: 'A', age: ' 0012 ', bio: '', terms: false })
    assert.equal(JSON.stringify(restored).includes('private-secret'), false)
    assert.deepEqual(s.parse(Submission, { values: {}, errors: { fields: {} } }), {
      values: {},
      errors: { fields: {} },
    })
  })

  it('preserves application errors and invalid input without running form validation or transforms', () => {
    let calls = 0
    let schema = fd.object({
      name: fd.text(
        s.string().transform((value) => {
          calls++
          return value.length
        }),
      ),
      quantity: fd.number(
        s.number().refine((value) => {
          calls++
          return Number.isInteger(value)
        }),
      ),
      tags: fd.fields(s.array(s.string().pipe(minLength(2)))),
      note: fd.text(
        s.defaulted(s.string(), () => {
          calls++
          return 'Default note'
        }),
      ),
    })
    let feedback = {
      values: { name: '', quantity: '1.5', tags: ['', 'a'] },
      errors: {
        fields: { quantity: ['Only two copies remain.'] },
        form: ['Please review your cart.'],
      },
    }
    let restored = s.parse(schema.submissionSchema, JSON.parse(JSON.stringify(feedback)))
    assert.deepEqual(restored, feedback)
    assert.equal(calls, 0)
  })

  it('uses logical field keys and strips sensitive values, files, and unknown properties', () => {
    let schema = fd.object({
      name: fd.text(s.string(), { name: 'user.name' }),
      card: fd.text(s.string(), { sensitive: true }),
      password: fd.password(s.string(), { sensitive: false }),
      upload: fd.file(s.instanceof_(Blob)),
      attachments: fd.files(s.array(s.instanceof_(Blob))),
    })
    let restored = s.parse(schema.submissionSchema, {
      values: {
        name: 'Ada',
        'user.name': 'Transport name',
        card: 'private-card',
        password: 'private-password',
        upload: 'file contents',
        attachments: ['more file contents'],
        other: 'unknown',
      },
      errors: {
        fields: { password: ['Invalid password'], upload: ['Invalid file'] },
        other: 'unknown',
      },
      issues: [{ message: 'Internal issue metadata' }],
    })
    assert.deepEqual(restored, {
      values: { name: 'Ada' },
      errors: { fields: { password: ['Invalid password'], upload: ['Invalid file'] } },
    })
  })

  it('rejects malformed feedback, incorrect raw kinds, and unknown field errors', () => {
    let Submission = fd.object({
      quantity: fd.number(s.number()),
      terms: fd.checkbox(),
      tags: fd.fields(s.array(s.string())),
    }).submissionSchema
    for (let values of [{ quantity: 1 }, { terms: 'false' }, { tags: ['a', 2] }]) {
      let result = s.parseSafe(Submission, { values, errors: { fields: {} } })
      if (result.success) throw new Error('Expected malformed values to fail')
      assert.equal(result.issues[0].path?.[0], 'values')
    }
    for (let feedback of [
      null,
      { values: {}, errors: {} },
      { values: {}, errors: { fields: { quantity: [1] } } },
      { values: {}, errors: { fields: { unknown: ['Invalid'] } } },
      { values: {}, errors: { fields: {}, form: 'Invalid' } },
    ]) {
      assert.equal(s.parseSafe(Submission, feedback).success, false)
    }
  })

  it('preserves reserved logical keys as own properties without changing prototypes', () => {
    let schema = fd.object({
      ['__proto__']: fd.text(s.string()),
      constructor: fd.text(s.string()),
      toString: fd.text(s.string()),
    })
    let feedback = JSON.parse(
      '{"values":{"__proto__":"raw","constructor":"","toString":"text"},"errors":{"fields":{"__proto__":["Invalid"],"constructor":["Required"]}}}',
    )
    let restored = s.parse(schema.submissionSchema, feedback)
    assert.deepEqual(restored, feedback)
    assert.equal(Object.hasOwn(restored.values, '__proto__'), true)
    assert.equal(Object.hasOwn(restored.errors.fields, '__proto__'), true)
    assert.equal(Object.getPrototypeOf(restored.values), Object.prototype)
    assert.equal(Object.getPrototypeOf(restored.errors.fields), Object.prototype)
  })
})
