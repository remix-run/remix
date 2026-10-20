import { createForm } from '@remix-run/ui/form'

import { loginSchema } from './login-schema.ts'

export const LoginForm = createForm({
  schema: loginSchema,
  fields: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
})
