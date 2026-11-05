import * as fd from 'remix/data-schema/experimental/form'
import { getSchemaMetadata } from 'remix/data-schema/experimental'
import { loginSchema } from './login-schema.ts'

const { shape } = getSchemaMetadata(loginSchema)

export const LoginForm = fd.object({
  email: fd.text(shape.email),
  password: fd.password(shape.password),
})
