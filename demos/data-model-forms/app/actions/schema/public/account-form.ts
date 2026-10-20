import { createForm } from '@remix-run/ui/form'

import { Account } from '../../../data/public/account-schema.ts'

export const AccountForm = createForm({
  schema: Account,
  fields: {
    displayName: { label: 'Display name', type: 'text' },
    email: { label: 'Email address', type: 'email' },
    age: { label: 'Age', type: 'number' },
    website: { label: 'Website', type: 'url' },
  },
})
