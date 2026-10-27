import { css } from 'remix/component'
import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'
import { minLength } from 'remix/data-schema/checks'

export const authCardStyle = css({ maxWidth: '500px', margin: '2rem auto' })

export const RegistrationForm = fd.object({
  name: fd.text(s.string()),
  email: fd.text(s.string()),
  password: fd.password(s.string().pipe(minLength(8))),
})

export const ForgotPasswordForm = fd.object({
  email: fd.text(s.string()),
})

export const ResetPasswordForm = fd.object({
  password: fd.password(s.string().pipe(minLength(8))),
  confirmPassword: fd.password(s.string().pipe(minLength(8))),
})

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
