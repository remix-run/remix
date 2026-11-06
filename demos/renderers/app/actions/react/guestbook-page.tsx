/** @jsxImportSource react */
import type { Entry } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { serializeJsonScript } from '../../utils/json-script.ts'
import type { EntryErrors, EntryValues } from '../../utils/public/validate-entry.ts'
import { Document } from './document.tsx'
import { EntryForm, type EntryFormProps } from './public/entry-form.tsx'

interface GuestbookPageProps {
  entries: Entry[]
  values: EntryValues
  errors: EntryErrors
}

export function GuestbookPage({ entries, values, errors }: GuestbookPageProps) {
  let formProps: EntryFormProps = { action: routes.react.sign.href(), values, errors }

  return (
    <Document title="Guestbook · React">
      <header>
        <p className="eyebrow">Rendered with React</p>
        <h1>Guestbook</h1>
        <p>
          Every page under <code>/react</code> is rendered by <code>react-dom/server</code> through
          a custom <code>context.render()</code>. The browser loads React from{' '}
          <code>esm.unpkg.com</code>.
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
        <ol className="entries">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a href={routes.react.entry.href({ id: String(entry.id) })}>{entry.name}</a>
              <p>{entry.message}</p>
            </li>
          ))}
        </ol>
      </section>
    </Document>
  )
}
