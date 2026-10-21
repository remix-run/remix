import type { FormFailure } from '@remix-run/ui/form'
import type { TableRow } from 'remix/data-table'
import type { Handle } from 'remix/component'

import type { accounts } from '../../data/account.ts'
import { ExamplePage } from '../../ui/example-page.tsx'
import { AccountFields } from './public/account-fields.tsx'

export function SchemaPage(
  handle: Handle<{
    storedAccounts: Array<TableRow<typeof accounts>>
    submission?: FormFailure
  }>,
) {
  return () => {
    let { storedAccounts, submission } = handle.props
    return (
      <ExamplePage
        active="schema"
        title="One object schema."
        description="Select fields from the account schema and add UI metadata. Validation rules stay in the model; the server supplies the omitted id."
        code={`createForm({
  schema: Account,
  fields: {
    displayName: { label: 'Name', type: 'text' },
    email: { label: 'Email', type: 'email' },
    age: { label: 'Age', type: 'number' },
    website: { label: 'Website', type: 'url' },
  },
})`}
        storedAccounts={storedAccounts}
      >
        <AccountFields
          submission={
            submission ? { values: submission.values, errors: submission.errors } : undefined
          }
        />
      </ExamplePage>
    )
  }
}
