import { css } from 'remix/component'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

export let authCardStyle = css({ maxWidth: '500px', margin: '2rem auto' })

let textField = f.field(s.defaulted(s.string(), ''))

export let registrationSchema = f.object({
  name: textField,
  email: textField,
  password: textField,
})

export let forgotPasswordSchema = f.object({
  email: textField,
})

export let resetPasswordSchema = f.object({
  password: textField,
  confirmPassword: textField,
})

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
