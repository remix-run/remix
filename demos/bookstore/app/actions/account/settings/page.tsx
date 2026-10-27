import type { Handle } from 'remix/component'
import type { FormSubmission } from 'remix/data-schema/form'

import type { User } from '../../../data/schema.ts'
import { Layout } from '../../../ui/layout.tsx'
import { AccountSettingsFields } from './public/settings-form.tsx'

export function AccountSettingsPage(handle: Handle<{ user: User; submission?: FormSubmission }>) {
  return () => {
    let { user } = handle.props

    return (
      <Layout>
        <h1>Account Settings</h1>

        <div class="card">
          <AccountSettingsFields
            name={user.name}
            email={user.email}
            submission={handle.props.submission}
          />
        </div>
      </Layout>
    )
  }
}
