import { css } from 'remix/component'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength } from 'remix/data-schema/checks'

export const authCardStyle = css({ maxWidth: '500px', margin: '2rem auto' })

const textField = f.field(s.defaulted(s.string(), ''))

export const registrationSchema = f.object({
  name: textField,
  email: textField,
  password: f.field(s.string().pipe(minLength(8))),
})

export const forgotPasswordSchema = f.object({
  email: textField,
})

export const resetPasswordSchema = f.object({
  password: f.field(s.string().pipe(minLength(8))),
  confirmPassword: f.field(s.string().pipe(minLength(8))),
})

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
