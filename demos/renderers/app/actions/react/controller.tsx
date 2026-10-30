/** @jsxImportSource react */
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { entries } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { hasErrors, validateEntry, type EntryValues } from '../../utils/public/validate-entry.ts'
import { EntryNotFoundPage, EntryPage } from './entry-page.tsx'
import { GuestbookPage } from './guestbook-page.tsx'
import { reactRenderer } from './renderer.ts'

const emptyValues: EntryValues = { name: '', message: '' }

export const reactController = createController(routes.react, {
  // Controller middleware scopes the renderer to this route map, so `render` here is React's.
  middleware: [reactRenderer()],
  actions: {
    async guestbook({ db, render }) {
      let latest = await db.findMany(entries, { orderBy: ['signed_at', 'desc'] })

      return render(<GuestbookPage entries={latest} values={emptyValues} errors={{}} />)
    },

    async sign({ db, render, request }) {
      let formData = await request.formData()
      let values: EntryValues = {
        name: String(formData.get('name') ?? ''),
        message: String(formData.get('message') ?? ''),
      }
      let errors = validateEntry(values)

      if (hasErrors(errors)) {
        let latest = await db.findMany(entries, { orderBy: ['signed_at', 'desc'] })

        return render(<GuestbookPage entries={latest} values={values} errors={errors} />, {
          status: 400,
        })
      }

      await db.create(entries, {
        name: values.name.trim(),
        message: values.message.trim(),
        signed_at: Date.now(),
      })

      return redirect(routes.react.guestbook.href(), 303)
    },

    async entry({ db, render, params }) {
      let id = Number(params.id)
      let entry = Number.isInteger(id) ? await db.find(entries, id) : null

      if (!entry) {
        return render(<EntryNotFoundPage />, { status: 404 })
      }

      return render(<EntryPage entry={entry} />)
    },
  },
})
