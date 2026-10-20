import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { max, maxLength, min, minLength } from '@remix-run/data-schema/checks'
import * as s from '@remix-run/data-schema'

import { createField, createForm } from './form.ts'

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

const UserForm = createForm({
  schema: User,
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
  // @ts-expect-error reusable fields require an authoritative schema
  createField({ label: 'Password', type: 'password' })
  createForm({
    schema: User,
    fields: {
      // @ts-expect-error ancillary fields require their own schema
      inviteCode: { label: 'Invite code', type: 'text' },
    },
  })
  createForm({
    schema: User,
    fields: {
      // @ts-expect-error model fields cannot override their authoritative schema
      name: { label: 'Name', type: 'text', schema: s.string() },
    },
  })
  createForm({
    fields: {
      // @ts-expect-error forms without a backing schema require a schema for every field
      password: { label: 'Password', type: 'password' },
    },
  })
}

void checkInvalidFieldTypes

describe('createField', () => {
  it('uses one error map for parsing and input validation with decoded context', () => {
    let contexts: s.ErrorMapContext[] = []
    let Age = createField({
      schema: s.number().pipe(min(13)),
      label: 'Age',
      type: 'number',
      name: 'profile.age',
      errorMap(context) {
        contexts.push(context)
        if (context.code === 'number.min') return 'You must be at least 13'
        if (context.code === 'value.required') return 'Enter your age'
      },
    })
    let data = new FormData()
    data.set('profile.age', '12')
    let failure = Age.parse(data, 'age')
    assert.equal(failure.success, false)
    assert.deepEqual(failure.errors.fields.age, ['You must be at least 13'])
    let message = ''
    Age.createInputValidator('age')({
      value: '12',
      setCustomValidity(value) {
        message = value
      },
    })
    assert.equal(message, 'You must be at least 13')
    assert.deepEqual(contexts[0], contexts[1])
    assert.equal(contexts[0].input, 12)
    assert.deepEqual(contexts[0].path, ['age'])
    assert.deepEqual(contexts[0].values, { min: 13 })
    let missing = Age.parse(new FormData(), 'age')
    assert.equal(missing.success, false)
    assert.deepEqual(missing.errors.fields.age, ['Enter your age'])
  })

  it('preserves explicit refinement messages during parsing and input validation', () => {
    let Username = createField({
      schema: s.string().refine((value) => value !== 'admin', 'Reserved username'),
      label: 'Username',
      type: 'text',
      errorMap() {
        throw new Error('Explicit refinement messages must bypass errorMap')
      },
    })
    let data = new FormData()
    data.set('username', 'admin')
    let failure = Username.parse(data, 'username')
    assert.equal(failure.success, false)
    assert.deepEqual(failure.errors.fields.username, ['Reserved username'])
    let message = ''
    Username.createInputValidator('username')({
      value: 'admin',
      setCustomValidity(value) {
        message = value
      },
    })
    assert.equal(message, 'Reserved username')
  })

  it('maps refinements without explicit messages and preserves the fallback', () => {
    let Username = createField({
      schema: s.string().refine((value) => value !== 'admin'),
      label: 'Username',
      type: 'text',
      errorMap({ code, defaultMessage }) {
        assert.equal(code, 'refine.failed')
        assert.equal(defaultMessage, 'Refinement failed')
        return 'Choose another username'
      },
    })
    let data = new FormData()
    data.set('username', 'admin')
    let failure = Username.parse(data, 'username')
    assert.equal(failure.success, false)
    assert.deepEqual(failure.errors.fields.username, ['Choose another username'])
    let Fallback = createField({ ...Username, errorMap: () => undefined })
    let fallback = Fallback.parse(data, 'username')
    assert.equal(fallback.success, false)
    assert.deepEqual(fallback.errors.fields.username, ['Refinement failed'])
  })

  it('maps required checkboxes without turning optional empty values into failures', () => {
    let Terms = createField({
      label: 'Terms',
      type: 'checkbox',
      schema: s.literal(true),
      errorMap({ code, input }) {
        assert.equal(code, 'value.required')
        assert.equal(input, false)
        return 'Accept the terms'
      },
    })
    let failure = Terms.parse(new FormData(), 'terms')
    assert.equal(failure.success, false)
    assert.deepEqual(failure.errors.fields.terms, ['Accept the terms'])
    let Optional = createField({
      label: 'Optional',
      type: 'text',
      schema: s.optional(s.string()),
      errorMap() {
        throw new Error('Optional empty values must not fail')
      },
    })
    assert.equal(Optional.parse(new FormData(), 'optional').success, true)
  })

  it('derives attributes and parses one field independently', () => {
    let Age = createField({ schema: s.number().pipe(min(13)), label: 'Age', type: 'number' })
    assert.equal(Age.required, true)
    assert.deepEqual(Age.getInputAttrs('age'), {
      id: 'age',
      name: 'age',
      type: 'number',
      required: true,
      min: 13,
      step: 'any',
    })
    let data = new FormData()
    data.set('age', '37')
    let result = Age.parse(data, 'age')
    assert.equal(result.success, true)
    expectType<Equal<typeof result.value, number>>()
    assert.equal(result.value, 37)
    data.set('age', '12')
    let failure = Age.parse(data, 'age')
    assert.equal(failure.success, false)
    assert.deepEqual(failure.values, { age: '12' })
    assert.equal(failure.errors.fields.age.length, 1)
    assert.equal(Age.getInputAttrs('age', failure).defaultValue, '12')
  })

  it('composes reusable fields without sharing names or overriding backing schemas', () => {
    let Name = createField({ schema: s.string(), label: 'Name', type: 'text' })
    let Names = createForm({ fields: { first: Name, second: Name } })
    let data = new FormData()
    data.set('first', 'Ada')
    data.set('second', 'Grace')
    let result = Names.parse(data)
    assert.equal(result.success, true)
    expectType<Equal<typeof result.value, { first: string; second: string }>>()
    assert.deepEqual(result.value, { first: 'Ada', second: 'Grace' })
    assert.equal(Names.fields.first.getInputAttrs('first').name, 'first')
    assert.equal(Name.getInputAttrs('other').name, 'other')
  })

  it('keeps logical error keys separate from native names and omits failed passwords', () => {
    let Password = createField({
      schema: s.string().pipe(minLength(8)),
      label: 'Password',
      type: 'password',
      name: 'credentials.password',
      id: 'new-password',
    })
    let data = new FormData()
    data.set('credentials.password', 'short')
    let result = Password.parse(data, 'password')
    assert.equal(result.success, false)
    assert.deepEqual(result.values, {})
    assert.deepEqual(result.issues[0].path, ['password'])
    assert.equal(result.errors.fields.password.length, 1)
    assert.equal(Password.getInputAttrs('password', result).defaultValue, undefined)
    assert.deepEqual(Password.getErrorAttrs('password'), { id: 'new-password-error' })
    assert.deepEqual(Password.getLabelAttrs('password'), { htmlFor: 'new-password' })
    let message = ''
    Password.createInputValidator('password')({
      value: 'long-enough',
      setCustomValidity(value) {
        message = value
      },
    })
    assert.equal(message, '')
  })
})

describe('createForm', () => {
  it('infers model-backed field maps without callback annotations', () => {
    let Form = createForm({
      schema: User,
      fields: {
        name: {
          label: 'Name',
          type: 'text',
          errorMap({ code }) {
            expectType<Equal<typeof code, string>>()
            if (code === 'string.min_length') return 'Use a longer name'
          },
        },
      },
    })
    let data = new FormData()
    data.set('name', 'a')
    let failure = Form.parse(data)
    expectType<Equal<ReturnType<typeof Form.getInputAttrs<'name'>>['type'], 'text'>>()
    assert.equal(failure.success, false)
    assert.deepEqual(failure.errors.fields.name, ['Use a longer name'])
  })

  it('retains field maps on model-backed, ancillary, inline, and reusable fields', () => {
    let field = {
      label: 'Name',
      type: 'text',
      errorMap: () => 'Use a longer name',
    } as const
    let Name = createField({ ...field, schema: s.string().pipe(minLength(3)) })
    let Form = createForm({
      schema: s.object({ model: Name.schema }),
      fields: { model: field, extra: { ...field, schema: Name.schema }, reused: Name },
    })
    let Inline = createForm({ fields: { name: { ...field, schema: Name.schema } } })
    let data = new FormData()
    data.set('model', 'a')
    data.set('extra', 'a')
    data.set('reused', 'a')
    data.set('name', 'a')
    let failure = Form.parse(data)
    assert.equal(failure.success, false)
    assert.deepEqual(failure.errors.fields, {
      model: ['Use a longer name'],
      extra: ['Use a longer name'],
      reused: ['Use a longer name'],
    })
    let inlineFailure = Inline.parse(data)
    assert.equal(inlineFailure.success, false)
    assert.deepEqual(inlineFailure.errors.fields.name, ['Use a longer name'])
  })

  it('infers and validates inline fields without a backing schema', () => {
    let InlineForm = createForm({
      fields: {
        name: { label: 'Name', type: 'text', schema: s.string().pipe(minLength(2)) },
        age: { label: 'Age', type: 'number', schema: s.number() },
        bio: { label: 'Bio', type: 'text', schema: s.optional(s.string()) },
        terms: { label: 'Accept the terms', type: 'checkbox', schema: s.literal(true) },
      },
    })
    let formData = new FormData()
    formData.set('name', 'Ada')
    formData.set('age', '37')
    formData.set('terms', 'on')

    let result = InlineForm.parse(formData)

    assert.equal(result.success, true)
    expectType<
      Equal<
        typeof result.value,
        { name: string; age: number; bio: string | undefined; terms: true }
      >
    >()
    assert.deepEqual(result.value, { name: 'Ada', age: 37, bio: undefined, terms: true })
    assert.deepEqual(InlineForm.getInputAttrs('name'), {
      id: 'name',
      name: 'name',
      type: 'text',
      required: true,
      minLength: 2,
    })
    assert.equal(InlineForm.fields.bio.required, false)

    let invalid = InlineForm.parse(new FormData())
    assert.equal(invalid.success, false)
    assert.deepEqual(invalid.errors.fields, {
      name: ['Expected string'],
      age: ['Expected number'],
      terms: ['Expected literal value'],
    })
  })

  it('rejects inline fields without schemas at runtime', () => {
    assert.throws(() => {
      createForm({
        fields: {
          // @ts-expect-error exercise the runtime guard for untyped callers
          name: { label: 'Name', type: 'text' },
        },
      })
    }, /Ancillary form field "name" requires a schema/)
  })

  it('derives native input attributes from projected model fields', () => {
    expectType<Equal<ReturnType<typeof UserForm.getInputAttrs<'name'>>['type'], 'text'>>()
    expectType<Equal<typeof UserForm.fields.name.required, boolean>>()

    assert.equal(UserForm.fields.name.required, true)
    assert.equal(UserForm.fields.age.required, true)
    assert.equal(UserForm.fields.bio.required, false)
    assert.equal(UserForm.fields.inviteCode.required, false)

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
    let SettingsForm = createForm({
      schema: Settings,
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
      'aria-invalid': 'true',
      'aria-describedby': 'name-error',
      'data-form-error-id': 'name-error',
    })
    assert.deepEqual(UserForm.getLabelAttrs('name'), { htmlFor: 'name' })
    assert.deepEqual(UserForm.getErrorAttrs('name'), { id: 'name-error' })
    assert.deepEqual(UserForm.getFieldErrors('name', result), ['Expected at least 2 characters'])
  })

  it('decodes and restores boolean checkbox fields', () => {
    let Preferences = s.object({ newsletter: s.boolean() })
    let PreferencesForm = createForm({
      schema: Preferences,
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
    assert.equal(PreferencesForm.fields.newsletter.required, false)
    assert.equal(PreferencesForm.fields.terms.required, true)

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

  it('treats reserved object property names as ancillary fields', () => {
    let Model = s.object({ name: s.string() })
    let ReservedNameForm = createForm({
      schema: Model,
      fields: {
        ['__proto__']: {
          label: 'Reserved name',
          type: 'text',
          schema: s.string(),
        },
      },
    })
    let formData = new FormData()
    formData.set('__proto__', 'safe value')

    let result = ReservedNameForm.parse(formData)

    assert.equal(result.success, true)
    assert.equal(Object.hasOwn(result.value, '__proto__'), true)
    assert.equal(result.value.__proto__, 'safe value')
  })

  it('does not serialize password values after failed validation', () => {
    let Credentials = s.object({ password: s.string().pipe(minLength(8)) })
    let CredentialsForm = createForm({
      schema: Credentials,
      fields: {
        password: { label: 'Password', type: 'password' },
      },
    })
    let formData = new FormData()
    formData.set('password', 'short')

    let result = CredentialsForm.parse(formData)

    assert.equal(result.success, false)
    assert.deepEqual(result.values, {})
    assert.equal(CredentialsForm.getInputAttrs('password', result).defaultValue, undefined)
  })

  it('sets and clears custom validity from field schema issues', () => {
    let Profile = s.object({
      username: s.string().refine((value) => value.startsWith('@'), 'Start with @'),
    })
    let ProfileForm = createForm({
      schema: Profile,
      fields: { username: { label: 'Username', type: 'text' } },
    })
    let validationMessage = ''
    let input = {
      value: 'ada',
      checked: false,
      setCustomValidity(message: string) {
        validationMessage = message
      },
    }
    let validateUsername = ProfileForm.createInputValidator('username')

    validateUsername(input)
    assert.equal(validationMessage, 'Start with @')

    input.value = '@ada'
    validateUsername(input)
    assert.equal(validationMessage, '')
  })

  it('uses form decoding for number and ancillary checkbox validators', () => {
    let Preferences = s.object({
      age: s.number().refine((value) => value >= 18, 'Must be at least 18'),
    })
    let PreferencesForm = createForm({
      schema: Preferences,
      fields: {
        age: { label: 'Age', type: 'number' },
        terms: {
          label: 'Accept the terms',
          type: 'checkbox',
          schema: s.literal(true),
        },
      },
    })
    let ageValidationMessage = ''
    let ageInput = {
      value: '17',
      checked: false,
      setCustomValidity(message: string) {
        ageValidationMessage = message
      },
    }
    let termsValidationMessage = ''
    let termsInput = {
      value: 'on',
      checked: false,
      setCustomValidity(message: string) {
        termsValidationMessage = message
      },
    }
    let validateAge = PreferencesForm.createInputValidator('age')
    let validateTerms = PreferencesForm.createInputValidator('terms')

    validateAge(ageInput)
    validateTerms(termsInput)

    assert.equal(ageValidationMessage, 'Must be at least 18')
    assert.equal(termsValidationMessage, 'Expected literal value')

    ageInput.value = '18'
    termsInput.checked = true
    validateAge(ageInput)
    validateTerms(termsInput)

    assert.equal(ageValidationMessage, '')
    assert.equal(termsValidationMessage, '')
  })
})
