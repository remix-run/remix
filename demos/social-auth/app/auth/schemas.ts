import { email, minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import * as s from 'remix/data-schema'

export let signupSchema = f.object({
  name: f.field(s.string().pipe(minLength(1))),
  email: f.field(s.string().pipe(email())),
  password: f.field(s.string().pipe(minLength(8))),
})

export let forgotPasswordSchema = f.object({
  email: f.field(s.string().pipe(email())),
})

export let resetPasswordSchema = f.object({
  password: f.field(s.string().pipe(minLength(8))),
  confirmPassword: f.field(s.string().pipe(minLength(8))),
})
