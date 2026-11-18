import type { Entry } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { serializeJsonScript } from '../../utils/json-script.ts'
import { Document } from './document.tsx'
import { EntryForm, type EntryFormProps } from './public/entry-form.tsx'
import type { EntryErrors, EntryValues } from '../../utils/public/validate-entry.ts'

interface GuestbookPageProps {
  entries: Entry[]
  values: EntryValues
  errors: EntryErrors
}

export function GuestbookPage({ entries, values, errors }: GuestbookPageProps) {
  let formProps: EntryFormProps = { action: routes.preact.sign.href(), values, errors }

  return (
    <Document title="Guestbook · Preact">
      <header>
        <p class="eyebrow">Rendered with Preact</p>
        <h1>Guestbook</h1>
        <p>
          Every page under <code>/preact</code> is rendered by <code>preact-render-to-string</code>{' '}
          through a custom <code>context.render()</code>.
        </p>
      </header>

      <section aria-labelledby="sign-heading">
        <h2 id="sign-heading">Sign it</h2>
        <div id="entry-form">
          <EntryForm {...formProps} />
        </div>
        <script
          id="entry-form-props"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: serializeJsonScript(formProps) }}
        />
      </section>

      <section aria-labelledby="entries-heading">
        <h2 id="entries-heading">Entries</h2>
        <ol class="entries">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a href={routes.preact.entry.href({ id: String(entry.id) })}>{entry.name}</a>
              <p>{entry.message}</p>
            </li>
          ))}
        </ol>
      </section>
    </Document>
  )
}
