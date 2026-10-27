import * as fd from 'remix/data-schema/form'
import { loginSchema } from './login-schema.ts'

export const LoginForm = fd.object({
  email: fd.text(loginSchema.shape.email),
  password: fd.password(loginSchema.shape.password),
})
