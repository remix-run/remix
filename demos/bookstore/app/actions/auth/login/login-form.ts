import { createForm } from 'remix/data-schema/form'

import { loginSchema } from './login-schema.ts'

export const LoginForm = createForm(loginSchema, {
  fields: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
})
