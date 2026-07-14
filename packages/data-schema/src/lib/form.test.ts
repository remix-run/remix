import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { max, maxLength, min, minLength } from '../checks.ts'
import { createForm } from '../form.ts'
import * as s from '../index.ts'

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
  },
})

describe('createForm', () => {
  it('derives native input attributes from projected model fields', () => {
    assert.deepEqual(UserForm.getInputAttrs('name'), {
      name: 'name',
      type: 'text',
      required: true,
      minLength: 2,
      maxLength: 50,
    })
    assert.deepEqual(UserForm.getInputAttrs('age'), {
      name: 'age',
      type: 'number',
      required: true,
      step: 'any',
      min: 13,
      max: 120,
    })
    assert.deepEqual(UserForm.getInputAttrs('bio'), {
      name: 'bio',
      type: 'text',
      maxLength: 200,
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

    assert.deepEqual(result, {
      success: true,
      value: { name: 'Ada', age: 37, bio: undefined },
    })
  })

  it('returns model validation issues with field paths', () => {
    let formData = new FormData()
    formData.set('name', 'A')
    formData.set('age', 'not-a-number')

    let result = UserForm.parse(formData)

    assert.equal(result.success, false)
    assert.deepEqual(
      result.issues.map((issue) => issue.path),
      [['name'], ['age']],
    )
  })
})
