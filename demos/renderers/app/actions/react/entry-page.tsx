/** @jsxImportSource react */
import type { Entry } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { Document } from './document.tsx'

export function EntryPage({ entry }: { entry: Entry }) {
  let signedAt = new Date(entry.signed_at)

  return (
    <Document title={`${entry.name} · Guestbook`}>
      <p>
        <a href={routes.react.guestbook.href()}>← Back to the guestbook</a>
      </p>
      <article>
        <h1>{entry.name}</h1>
        <p>{entry.message}</p>
        <p className="hint">
          Signed <time dateTime={signedAt.toISOString()}>{signedAt.toUTCString()}</time>
        </p>
      </article>
    </Document>
  )
}

export function EntryNotFoundPage() {
  return (
    <Document title="Entry not found · Guestbook">
      <h1>Entry not found</h1>
      <p>
        That entry does not exist. <a href={routes.react.guestbook.href()}>Back to the guestbook</a>
      </p>
    </Document>
  )
}
