import type { Handle } from 'remix/component'
import type { FormSubmission } from 'remix/data-schema/form'

import type { User } from '../../../data/schema.ts'
import { Layout } from '../../../ui/layout.tsx'
import { AdminUserFields } from './public/user-form.tsx'

export interface AdminUserFormPageProps {
  title: string
  action: string
  cancelHref: string
  submitLabel: string
  user: User
  submission?: FormSubmission
}

export function AdminUserFormPage(handle: Handle<AdminUserFormPageProps>) {
  return () => {
    let { action, cancelHref, submitLabel, title, user, submission } = handle.props

    return (
      <Layout>
        <h1>{title}</h1>

        <div class="card">
          <AdminUserFields
            action={action}
            cancelHref={cancelHref}
            submitLabel={submitLabel}
            name={user.name}
            email={user.email}
            role={user.role}
            submission={submission}
          />
        </div>
      </Layout>
    )
  }
}
