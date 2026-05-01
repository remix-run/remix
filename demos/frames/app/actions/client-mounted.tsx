import type { BuildAction } from 'remix/fetch-router'

import { ClientMountedPageExample } from '../assets/client-mounted-page-example.tsx'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { render } from '../utils/render.ts'

export const clientMountedAction = {
  handler(context) {
    return render(<ClientMountedPage />, { request: context.request, router: context.router })
  },
} satisfies BuildAction<'GET', typeof routes.clientMounted>

function ClientMountedPage() {
  return () => (
    <Document title="Client-mounted nested frame">
      <a href={routes.home.href()} style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
        ← Back
      </a>
      <h1 style={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
        Client-mounted nested non-blocking frame
      </h1>
      <p style={{ marginTop: 0, color: '#b9c6ff' }}>
        Mount the outer frame, then watch the nested frame fallback render before its server content
        streams in.
      </p>
      <ClientMountedPageExample />
    </Document>
  )
}
