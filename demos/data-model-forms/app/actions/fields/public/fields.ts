import { createField } from '@remix-run/ui/form'

import { DisplayNameSchema, EmailSchema } from '../../../data/public/account-schema.ts'

export const DisplayName = createField({
  schema: DisplayNameSchema,
  label: 'Display name',
  type: 'text',
})

export const Email = createField({
  schema: EmailSchema,
  label: 'Email address',
  type: 'email',
})
