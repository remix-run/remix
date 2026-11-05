import * as s from '@remix-run/data-schema'
import * as fd from '@remix-run/data-schema/experimental/form'
import { getSchemaMetadata } from '@remix-run/data-schema/experimental'
import { max, maxLength, min, minLength } from '@remix-run/data-schema/checks'
import type { FieldBinding, FieldBindings, GetConstraintsOptions } from './form.ts'

type Equal<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2
    ? true
    : false
function expectType<condition extends true>(_value?: condition): void {}

expectType<Equal<string extends GetConstraintsOptions['type'] ? true : false, false>>()
expectType<
  Equal<
      | 'datetime-local'
      | 'radio'
      | 'range'
      | 'file'
      | 'select'
      | 'textarea' extends GetConstraintsOptions['type']
      ? true
      : false,
    true
  >
>()

const User = s.object({
  id: s.string(),
  name: s.string().pipe(minLength(2), maxLength(50)),
  age: s.number().pipe(min(13), max(120)),
})
expectType<Equal<'shape' extends keyof typeof User ? true : false, false>>()
expectType<Equal<'getSchemaMetadata' extends keyof typeof s ? true : false, false>>()
const Profile = fd.object({
  name: fd.text(getSchemaMetadata(User).shape.name),
  age: fd.number(getSchemaMetadata(User).shape.age),
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
expectType<Equal<FieldBindings<typeof Profile.entries>['password'], FieldBinding<'password'>>>()
const mutableEntries = { name: fd.text(s.string()) }
const MutableForm = fd.object(mutableEntries)
expectType<Equal<typeof MutableForm.entries, Readonly<typeof mutableEntries>>>()
const RepeatedForm = fd.object({ tags: fd.fields(s.array(s.string())) })
expectType<Equal<FieldBindings<typeof RepeatedForm.entries>['tags'], FieldBinding<'fields'>>>()
expectType<Equal<Extract<keyof FieldBindings<typeof Profile.entries>, 'unknown'>, never>>()
const UploadForm = fd.object({
  avatar: fd.file(s.optional(s.instanceof_(Blob))),
  attachments: fd.files(s.array(s.instanceof_(Blob))),
})
expectType<Equal<FieldBindings<typeof UploadForm.entries>['avatar'], FieldBinding<'file'>>>()
expectType<Equal<FieldBindings<typeof UploadForm.entries>['attachments'], FieldBinding<'files'>>>()
