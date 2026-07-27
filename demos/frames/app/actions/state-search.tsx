import type { Handle } from 'remix/ui'

import { StateSearchPage } from './public/state-search-page.tsx'
import { routes } from '../routes.ts'
import { leadStyle, linkStyle, pageHeadingStyle } from '../ui/styles.ts'
import { Document } from '../ui/document.tsx'

export function StateSearchRoutePage(handle: Handle<{ initialQuery: string }>) {
  return () => (
    <Document title="Dynamic Frame src search">
      <a href={routes.home.href()} mix={linkStyle}>
        ← Back
      </a>
      <h1 mix={pageHeadingStyle}>
        Dynamic <code>{'<Frame src>'}</code> state search
      </h1>
      <p mix={leadStyle}>
        Submit the form to update the frame <code>src</code> query params and fetch matching U.S.
        states.
      </p>
      <StateSearchPage initialQuery={handle.props.initialQuery} />
    </Document>
  )
}
