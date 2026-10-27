import type { FormSubmission } from 'remix/data-schema/form'
import type { TableRow } from 'remix/data-table'
import type { Handle } from 'remix/component'

import type { accounts } from '../../data/account.ts'
import { ExamplePage } from '../../ui/example-page.tsx'
import { AccountFields } from './public/account-fields.tsx'

export function FieldsPage(
  handle: Handle<{
    storedAccounts: Array<TableRow<typeof accounts>>
    submission?: FormSubmission
  }>,
) {
  return () => (
    <ExamplePage
      active="fields"
      title="Field components."
      description="Pass stable bindings through props to ordinary child components. One form schema validates the complete submission."
      code={`<form.Context id={handle.id} schema={AccountForm} submission={submission}>
  {({ fields }) => (
    <EmailField field={fields.email} />
  )}
</form.Context>`}
      storedAccounts={handle.props.storedAccounts}
    >
      <AccountFields submission={handle.props.submission} />
    </ExamplePage>
  )
}
