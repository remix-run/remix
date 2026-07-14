import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { max, maxLength, min, minLength } from '../checks.ts'
import { createForm } from '../form.ts'
import * as s from '../index.ts'

type Equal<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2
    ? true
    : false

function expectType<condition extends true>(_value?: condition): void {}

const User = s.object({
  id: s.string(),
  name: s.string().pipe(minLength(2), maxLength(50)),
  age: s.number().pipe(min(13), max(120)),
  bio: s.optional(s.string().pipe(maxLength(200))),
})

const UserForm = createForm(User, {
  fields: {
    name: { label: 'Name', type: 'text' },
    age: { label: 'Age', type: 'number' },
    bio: { label: 'Bio', type: 'text' },
    inviteCode: {
      label: 'Invite code',
      type: 'text',
      schema: s.optional(s.string().pipe(maxLength(12))),
    },
  },
})

function checkInvalidFieldTypes(): void {
  createForm(User, {
    fields: {
      // @ts-expect-error ancillary fields require their own schema
      inviteCode: { label: 'Invite code', type: 'text' },
    },
  })
  createForm(User, {
    fields: {
      // @ts-expect-error model fields cannot override their authoritative schema
      name: { label: 'Name', type: 'text', schema: s.string() },
    },
  })
}

void checkInvalidFieldTypes

describe('createForm', () => {
  it('derives native input attributes from projected model fields', () => {
    assert.deepEqual(UserForm.getInputAttrs('name'), {
      id: 'name',
      name: 'name',
      type: 'text',
      required: true,
      minLength: 2,
      maxLength: 50,
    })
    assert.deepEqual(UserForm.getInputAttrs('age'), {
      id: 'age',
      name: 'age',
      type: 'number',
      required: true,
      step: 'any',
      min: 13,
      max: 120,
    })
    assert.deepEqual(UserForm.getInputAttrs('bio'), {
      id: 'bio',
      name: 'bio',
      type: 'text',
      maxLength: 200,
    })
    assert.deepEqual(UserForm.getInputAttrs('inviteCode'), {
      id: 'inviteCode',
      name: 'inviteCode',
      type: 'text',
      maxLength: 12,
    })
  })

  it('does not evaluate defaults while deriving attributes', () => {
    let calls = 0
    let Settings = s.object({
      theme: s.defaulted(s.string(), () => {
        calls += 1
        return 'system'
      }),
    })
    let SettingsForm = createForm(Settings, {
      fields: { theme: { label: 'Theme', type: 'text' } },
    })

    assert.deepEqual(SettingsForm.getInputAttrs('theme'), {
      id: 'theme',
      name: 'theme',
      type: 'text',
    })
    assert.equal(calls, 0)
  })

  it('decodes FormData before validating with the model field schemas', () => {
    let formData = new FormData()
    formData.set('name', 'Ada')
    formData.set('age', '37')

    let result = UserForm.parse(formData)

    if (result.success) {
      expectType<
        Equal<
          typeof result.value,
          {
            name: string
            age: number
            bio: string | undefined
            inviteCode: string | undefined
          }
        >
      >()
    }

    assert.deepEqual(result, {
      success: true,
      value: { name: 'Ada', age: 37, bio: undefined, inviteCode: undefined },
    })
  })

  it('returns model validation issues with field paths', () => {
    let formData = new FormData()
    formData.set('name', 'A')
    formData.set('age', 'not-a-number')

    let result = UserForm.parse(formData)

    assert.equal(result.success, false)
    assert.deepEqual(result.values, {
      name: 'A',
      age: 'not-a-number',
    })
    assert.deepEqual(result.errors.fields, {
      name: ['Expected at least 2 characters'],
      age: ['Expected number'],
    })
    assert.deepEqual(result.errors.form, [])
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
    assert.deepEqual(
      result.issues.map((issue) => issue.path),
      [['name'], ['age']],
    )

    assert.deepEqual(UserForm.getInputAttrs('name', result), {
      id: 'name',
      name: 'name',
      type: 'text',
      required: true,
      minLength: 2,
      maxLength: 50,
      defaultValue: 'A',
      'aria-invalid': true,
      'aria-describedby': 'name-error',
      'data-form-error-id': 'name-error',
    })
    assert.deepEqual(UserForm.getLabelAttrs('name'), { htmlFor: 'name' })
    assert.deepEqual(UserForm.getErrorAttrs('name'), { id: 'name-error' })
    assert.deepEqual(UserForm.getFieldErrors('name', result), ['Expected at least 2 characters'])
  })

  it('decodes and restores boolean checkbox fields', () => {
    let Preferences = s.object({ newsletter: s.boolean() })
    let PreferencesForm = createForm(Preferences, {
      fields: {
        newsletter: { label: 'Send me updates', type: 'checkbox' },
        terms: {
          label: 'Accept the terms',
          type: 'checkbox',
          schema: s.literal(true),
        },
      },
    })

    assert.deepEqual(PreferencesForm.getInputAttrs('newsletter'), {
      id: 'newsletter',
      name: 'newsletter',
      type: 'checkbox',
    })
    assert.deepEqual(PreferencesForm.getInputAttrs('terms'), {
      id: 'terms',
      name: 'terms',
      type: 'checkbox',
      required: true,
    })

    let validData = new FormData()
    validData.set('newsletter', 'on')
    validData.set('terms', 'on')
    assert.deepEqual(PreferencesForm.parse(validData), {
      success: true,
      value: { newsletter: true, terms: true },
    })

    let invalid = PreferencesForm.parse(new FormData())
    assert.equal(invalid.success, false)
    assert.deepEqual(invalid.values, { newsletter: false, terms: false })
    assert.equal(PreferencesForm.getInputAttrs('terms', invalid).defaultChecked, false)
  })
})
