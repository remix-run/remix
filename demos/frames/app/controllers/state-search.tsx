import type { BuildAction } from 'remix/fetch-router'
import type { Handle } from 'remix/component'

import { StateSearchPage } from '../assets/state-search-page.tsx'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { render } from '../utils/render.ts'

export const stateSearchAction = {
  handler(context) {
    let initialQuery = new URL(context.request.url).searchParams.get('query') ?? ''

    return render(<StateSearchRoutePage initialQuery={initialQuery} />, {
      request: context.request,
      router: context.router,
    })
  },
} satisfies BuildAction<'GET', typeof routes.stateSearch>

function StateSearchRoutePage(handle: Handle<{ initialQuery: string }>) {
  return () => (
    <Document title="Dynamic Frame src search">
      <a href={routes.home.href()} style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
        ← Back
      </a>
      <h1 style={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
        Dynamic <code>{'<Frame src>'}</code> state search
      </h1>
      <p style={{ marginTop: 0, color: '#b9c6ff' }}>
        Submit the form to update the frame <code>src</code> query params and fetch matching U.S.
        states.
      </p>
      <StateSearchPage initialQuery={handle.props.initialQuery} />
    </Document>
  )
}
