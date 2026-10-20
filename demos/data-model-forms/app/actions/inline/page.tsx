import type { FormFailure } from '@remix-run/ui/form'
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
        description="No backing object schema is needed. Define each schema alongside its UI metadata, then parse the whole submission with createForm."
        code={`createForm({
  fields: {
    displayName: {
      label: 'Name',
      type: 'text',
      schema: s.string().pipe(minLength(2)),
    },
    email: {
      label: 'Email',
      type: 'email',
      schema: s.string().pipe(email()),
    },
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
