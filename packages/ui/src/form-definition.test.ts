import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as s from '@remix-run/data-schema'
import * as fd from '@remix-run/data-schema/form'
import { max, maxLength, min, minLength } from '@remix-run/data-schema/checks'
import type { FieldBinding, FieldBindings } from './form.ts'

type Equal<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2
    ? true
    : false
function expectType<condition extends true>(_value?: condition): void {}

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

expectType<
  Equal<
    fd.FormValue<typeof Profile.entries>,
    {
      readonly name: string
      readonly age: number
      readonly bio: string | undefined
      readonly password: string
      readonly terms: true
    }
  >
>()
expectType<Equal<ReturnType<typeof Profile.parse>, fd.InferOutput<typeof Profile>>>()
expectType<
  Equal<ReturnType<typeof Profile.parseSafe>, fd.FormParseResult<fd.InferOutput<typeof Profile>>>
>()
expectType<Equal<FieldBindings<typeof Profile.entries>['password'], FieldBinding<'password'>>>()
const mutableEntries = { name: fd.text(s.string()) }
const MutableForm = fd.object(mutableEntries)
expectType<Equal<typeof MutableForm.entries, Readonly<typeof mutableEntries>>>()
const RepeatedForm = fd.object({ tags: fd.fields(s.array(s.string())) })
expectType<
  Equal<
    FieldBindings<typeof RepeatedForm.entries>['tags'] extends FieldBinding ? true : false,
    false
  >
>()
expectType<Equal<Extract<keyof FieldBindings<typeof Profile.entries>, 'unknown'>, never>>()

describe('form schema integration', () => {
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
})
