import type { FormFailure } from 'remix/data-schema/form'
import type { TableRow } from 'remix/data-table'
import type { Handle } from 'remix/component'

import type { accounts } from '../../data/account.ts'
import { ExamplePage } from '../../ui/example-page.tsx'
import { AccountFields } from './public/account-fields.tsx'

export function InlinePage(
  handle: Handle<{
    storedAccounts: Array<TableRow<typeof accounts>>
    submission?: FormFailure
  }>,
) {
  return () => {
    let { storedAccounts, submission } = handle.props
    return (
      <ExamplePage
        active="inline"
        title="All inline schemas."
        description="No backing object schema is needed. Define validation inline in one form schema, then use it for parsing and UI."
        code={`fd.object({
  displayName: fd.text(s.string().pipe(minLength(2))),
  email: fd.text(s.string().pipe(email())),
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
