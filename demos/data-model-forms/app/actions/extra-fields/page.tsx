import type { FormFailure } from '@remix-run/ui/form'
import type { TableRow } from 'remix/data-table'
import type { Handle } from 'remix/component'

import { RegistrationFields } from './public/registration-fields.tsx'
import type { accounts } from '../../data/account.ts'
import { ExamplePage } from '../../ui/example-page.tsx'

interface RegistrationPageProps {
  storedAccounts: Array<TableRow<typeof accounts>>
  submission?: FormFailure
}

export function RegistrationPage(handle: Handle<RegistrationPageProps>) {
  return () => {
    let { storedAccounts, submission } = handle.props

    return (
      <ExamplePage
        active="extra-fields"
        title="Schema + extra fields."
        description="Reuse account fields and add request-only password and terms fields. Only the account data is saved."
        code={`createForm({
  schema: Account,
  fields: {
    email: { label: 'Email', type: 'email' },
    password: Password,
    terms: {
      label: 'Accept terms',
      type: 'checkbox',
      schema: s.literal(true),
    },
  },
})`}
        storedAccounts={storedAccounts}
      >
        <RegistrationFields
          submission={
            submission ? { values: submission.values, errors: submission.errors } : undefined
          }
        />
      </ExamplePage>
    )
  }
}
