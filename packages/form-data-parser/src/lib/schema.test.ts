import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import * as s from '@remix-run/data-schema'
import { minLength } from '@remix-run/data-schema/checks'
import * as coerce from '@remix-run/data-schema/coerce'

import * as f from '../schema.ts'

describe('object', () => {
  it('parses single text fields', () => {
    let formData = new FormData()
    formData.set('email', 'ada@example.com')
    formData.set('password', 'secret')

    let result = s.parse(
      f.object({
        email: f.field(s.string()),
        password: f.field(s.string().pipe(minLength(1))),
      }),
      formData,
    )

    assert.deepEqual(result, {
      email: 'ada@example.com',
      password: 'secret',
    })
  })

  it('supports custom form field names', () => {
    let formData = new FormData()
    formData.set('user-email', 'ada@example.com')

    let result = s.parse(
      f.object({
        email: f.field(s.string(), { name: 'user-email' }),
      }),
      formData,
    )

    assert.deepEqual(result, {
      email: 'ada@example.com',
    })
  })

  it('parses repeated text fields', () => {
    let formData = new FormData()
    formData.append('tags', 'one')
    formData.append('tags', 'two')

    let result = s.parse(
      f.object({
        tags: f.fields(s.array(s.string())),
      }),
      formData,
    )

    assert.deepEqual(result, {
      tags: ['one', 'two'],
    })
  })

  it('parses text fields from URLSearchParams', () => {
    let searchParams = new URLSearchParams()
    searchParams.set('email', 'ada@example.com')
    searchParams.set('password', 'secret')

    let result = s.parse(
      f.object({
        email: f.field(s.string()),
        password: f.field(s.string().pipe(minLength(1))),
      }),
      searchParams,
    )

    assert.deepEqual(result, {
      email: 'ada@example.com',
      password: 'secret',
    })
  })

  it('parses repeated text fields from URLSearchParams', () => {
    let searchParams = new URLSearchParams()
    searchParams.append('tags', 'one')
    searchParams.append('tags', 'two')

    let result = s.parse(
      f.object({
        tags: f.fields(s.array(s.string())),
      }),
      searchParams,
    )

    assert.deepEqual(result, {
      tags: ['one', 'two'],
    })
  })

  it('parses a single file field', async () => {
    let formData = new FormData()
    let avatar = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    formData.set('avatar', avatar)

    let result = s.parse(
      f.object({
        avatar: f.file(s.instanceof_(File)),
      }),
      formData,
    )

    assert.equal(result.avatar.name, 'avatar.png')
    assert.equal(await result.avatar.text(), 'avatar')
  })

  it('parses repeated file fields', async () => {
    let formData = new FormData()
    formData.append('attachments', new File(['one'], 'one.txt', { type: 'text/plain' }))
    formData.append('attachments', new File(['two'], 'two.txt', { type: 'text/plain' }))

    let result = s.parse(
      f.object({
        attachments: f.files(s.array(s.instanceof_(File))),
      }),
      formData,
    )

    assert.equal(result.attachments.length, 2)
    assert.equal(result.attachments[0]?.name, 'one.txt')
    assert.equal(await result.attachments[1]!.text(), 'two')
  })

  it('passes undefined to optional fields when a value is missing', () => {
    let formData = new FormData()

    let result = s.parse(
      f.object({
        nickname: f.field(s.optional(s.string())),
      }),
      formData,
    )

    assert.deepEqual(result, {
      nickname: undefined,
    })
  })

  it('throws a ValidationError when parsing fails', () => {
    let formData = new FormData()
    formData.set('age', 'not-a-number')

    assert.throws(
      () =>
        s.parse(
          f.object({
            age: f.field(coerce.number()),
          }),
          formData,
        ),
      (error: unknown) => {
        assert.ok(error instanceof s.ValidationError)
        assert.deepEqual(error.issues[0]?.path, ['age'])
        return true
      },
    )
  })

  it('reports text/file kind mismatches in the safe result', () => {
    let formData = new FormData()
    formData.set('avatar', new File(['avatar'], 'avatar.png', { type: 'image/png' }))

    let result = s.parseSafe(
      f.object({
        avatar: f.field(s.string()),
      }),
      formData,
    )

    assert.equal(result.success, false)
    assert.equal(result.issues[0]?.message, 'Expected text field "avatar"')
    assert.deepEqual(result.issues[0]?.path, ['avatar'])
  })

  it('reports file mismatches from URLSearchParams in the safe result', () => {
    let searchParams = new URLSearchParams()
    searchParams.set('avatar', 'avatar.png')

    let result = s.parseSafe(
      f.object({
        avatar: f.file(s.instanceof_(File)),
      }),
      searchParams,
    )

    assert.equal(result.success, false)
    assert.equal(result.issues[0]?.message, 'Expected file field "avatar"')
    assert.deepEqual(result.issues[0]?.path, ['avatar'])
  })

  it('prefixes nested schema issues with the parsed field path', () => {
    let formData = new FormData()
    formData.append('ages', '1')
    formData.append('ages', 'x')

    let result = s.parseSafe(
      f.object({
        ages: f.fields(s.array(coerce.number())),
      }),
      formData,
    )

    assert.equal(result.success, false)
    assert.deepEqual(result.issues[0]?.path, ['ages', 1])
    assert.equal(result.issues[0]?.message, 'Expected number')
  })

  it('rejects unsupported root input values', () => {
    let result = s.parseSafe(
      f.object({
        email: f.field(s.string()),
      }),
      { email: 'ada@example.com' },
    )

    assert.equal(result.success, false)
    assert.equal(result.issues[0]?.message, 'Expected FormData or URLSearchParams')
    assert.deepEqual(result.issues[0]?.path, undefined)
  })
})
