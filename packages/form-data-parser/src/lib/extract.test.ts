import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { array, instanceof_, optional, string, ValidationError } from '@remix-run/data-schema'
import { minLength } from '@remix-run/data-schema/checks'
import * as coerce from '@remix-run/data-schema/coerce'

import { extractFormData, extractFormDataSafe, field, fields, file, files } from '../extract.ts'

describe('extractFormData', () => {
  it('extracts single text fields', () => {
    let formData = new FormData()
    formData.set('email', 'ada@example.com')
    formData.set('password', 'secret')

    let result = extractFormData(formData, {
      email: field(string()),
      password: field(string().pipe(minLength(1))),
    })

    assert.deepEqual(result, {
      email: 'ada@example.com',
      password: 'secret',
    })
  })

  it('supports custom form field names', () => {
    let formData = new FormData()
    formData.set('user-email', 'ada@example.com')

    let result = extractFormData(formData, {
      email: field(string(), { name: 'user-email' }),
    })

    assert.deepEqual(result, {
      email: 'ada@example.com',
    })
  })

  it('extracts repeated text fields', () => {
    let formData = new FormData()
    formData.append('tags', 'one')
    formData.append('tags', 'two')

    let result = extractFormData(formData, {
      tags: fields(array(string())),
    })

    assert.deepEqual(result, {
      tags: ['one', 'two'],
    })
  })

  it('extracts a single file field', async () => {
    let formData = new FormData()
    let avatar = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    formData.set('avatar', avatar)

    let result = extractFormData(formData, {
      avatar: file(instanceof_(File)),
    })

    assert.equal(result.avatar.name, 'avatar.png')
    assert.equal(await result.avatar.text(), 'avatar')
  })

  it('extracts repeated file fields', async () => {
    let formData = new FormData()
    formData.append('attachments', new File(['one'], 'one.txt', { type: 'text/plain' }))
    formData.append('attachments', new File(['two'], 'two.txt', { type: 'text/plain' }))

    let result = extractFormData(formData, {
      attachments: files(array(instanceof_(File))),
    })

    assert.equal(result.attachments.length, 2)
    assert.equal(result.attachments[0]?.name, 'one.txt')
    assert.equal(await result.attachments[1]!.text(), 'two')
  })

  it('passes undefined to optional fields when a value is missing', () => {
    let formData = new FormData()

    let result = extractFormData(formData, {
      nickname: field(optional(string())),
    })

    assert.deepEqual(result, {
      nickname: undefined,
    })
  })

  it('throws a ValidationError when extraction fails', () => {
    let formData = new FormData()
    formData.set('age', 'not-a-number')

    assert.throws(() =>
      extractFormData(formData, {
        age: field(coerce.number()),
      }),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError)
        assert.deepEqual(error.issues[0]?.path, ['age'])
        return true
      },
    )
  })

  it('reports text/file kind mismatches in the safe result', () => {
    let formData = new FormData()
    formData.set('avatar', new File(['avatar'], 'avatar.png', { type: 'image/png' }))

    let result = extractFormDataSafe(formData, {
      avatar: field(string()),
    })

    assert.equal(result.success, false)
    assert.equal(result.issues[0]?.message, 'Expected text field "avatar"')
    assert.deepEqual(result.issues[0]?.path, ['avatar'])
  })

  it('prefixes nested schema issues with the extracted field path', () => {
    let formData = new FormData()
    formData.append('ages', '1')
    formData.append('ages', 'x')

    let result = extractFormDataSafe(formData, {
      ages: fields(array(coerce.number())),
    })

    assert.equal(result.success, false)
    assert.deepEqual(result.issues[0]?.path, ['ages', 1])
    assert.equal(result.issues[0]?.message, 'Expected number')
  })
})
