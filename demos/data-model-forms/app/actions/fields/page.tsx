import type { FormSubmission } from '@remix-run/ui/form'
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
      title="Independent fields."
      description="Bind individual field schemas without createForm. Native HTML combines the controls; the handler parses each field and combines failed values and errors."
      code={`const Email = createField({
  schema: EmailSchema,
  label: 'Email',
  type: 'email',
})

// Component setup:
let email = createFieldMixins(Email, {
  name: 'email',
  getSubmission: () => handle.props.submission,
  onChange: () => handle.update(),
})

// Handler:
let result = Email.parse(formData, 'email')`}
      storedAccounts={handle.props.storedAccounts}
    >
      <AccountFields submission={handle.props.submission} />
    </ExamplePage>
  )
}
