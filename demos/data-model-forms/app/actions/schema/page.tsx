import type { FormFailure } from 'remix/data-schema/form'
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
        description="Reuse account field rules in a form schema. Validation rules stay in the model; the server supplies the omitted id."
        code={`fd.object({
  displayName: fd.text(Account.shape.displayName),
  email: fd.text(Account.shape.email),
  age: fd.number(Account.shape.age),
  website: fd.text(Account.shape.website),
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
