import { Frame } from 'remix/component'
import type { BuildAction } from 'remix/fetch-router'

import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { render } from '../utils/render.ts'

export const timeAction = {
  handler(context) {
    return render(<TimePage />, { request: context.request, router: context.router })
  },
} satisfies BuildAction<'GET', typeof routes.time>

function TimePage() {
  return () => (
    <Document title="Server time" maxWidth="720px">
      <a href={routes.home.href()} style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
        ← Back
      </a>

      <h1 style={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
        Server time (Frame reload)
      </h1>
      <p style={{ marginTop: 0, color: '#b9c6ff' }}>
        The frame below renders the current server time. Click “Refresh” to call{' '}
        <code>frame.reload()</code> from a client entry inside the frame.
      </p>

      <div
        style={{
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: 16,
          background: 'rgba(255,255,255,0.04)',
        }}
      >
        <Frame
          src={routes.frames.time.href()}
          fallback={<div style={{ color: '#9aa8e8' }}>Loading server time…</div>}
        />
      </div>
    </Document>
  )
}
