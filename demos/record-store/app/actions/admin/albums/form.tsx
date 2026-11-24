import type { Handle } from 'remix/component'
import type { FormSubmission } from 'remix/data-schema/experimental/form'

import type { Album } from '../../../data/schema.ts'
import { Layout } from '../../../ui/layout.tsx'
import { AdminAlbumFields } from './public/album-form.tsx'

export interface AdminAlbumFormPageProps {
  title: string
  action: string
  cancelHref: string
  submitLabel: string
  method?: 'POST' | 'PUT'
  album?: Album
  submission?: FormSubmission
}

export function AdminAlbumFormPage(handle: Handle<AdminAlbumFormPageProps>) {
  return () => {
    let {
      action,
      album,
      cancelHref,
      method = 'POST',
      submitLabel,
      title,
      submission,
    } = handle.props

    return (
      <Layout>
        <h1>{title}</h1>

        <div class="card">
          <AdminAlbumFields
            action={action}
            cancelHref={cancelHref}
            submitLabel={submitLabel}
            method={method}
            album={album}
            submission={submission}
          />
        </div>
      </Layout>
    )
  }
}
