import { ClientMountedPageExample } from './public/client-mounted-page-example.tsx'
import { routes } from '../routes.ts'
import { leadStyle, linkStyle, pageHeadingStyle } from '../ui/public/styles.ts'
import { Document } from '../ui/document.tsx'

export function ClientMountedPage() {
  return () => (
    <Document title="Client-mounted nested frame">
      <a href={routes.home.href()} mix={linkStyle}>
        ← Back
      </a>
      <h1 mix={pageHeadingStyle}>Client-mounted nested non-blocking frame</h1>
      <p mix={leadStyle}>
        Mount the outer frame, then watch the nested frame fallback render before its server content
        streams in.
      </p>
      <ClientMountedPageExample />
    </Document>
  )
}
