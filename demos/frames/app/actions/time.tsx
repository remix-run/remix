import { Frame } from 'remix/ui'

import { routes } from '../routes.ts'
import { leadStyle, linkStyle, mutedStyle, pageHeadingStyle, panelStyle } from '../ui/styles.ts'
import { Document } from '../ui/document.tsx'

export function TimePage() {
  return () => (
    <Document title="Server time" maxWidth="720px">
      <a href={routes.home.href()} mix={linkStyle}>
        ← Back
      </a>

      <h1 mix={pageHeadingStyle}>Server time (Frame reload)</h1>
      <p mix={leadStyle}>
        The frame below renders the current server time. Click “Refresh” to call{' '}
        <code>frame.reload()</code> from a client entry inside the frame.
      </p>

      <div mix={panelStyle}>
        <Frame
          src={routes.frames.time.href()}
          fallback={<div mix={mutedStyle}>Loading server time…</div>}
        />
      </div>
    </Document>
  )
}
