import { css } from 'remix/ui'

import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { leadStyle, linkStyle, pageHeadingStyle } from '../ui/public/styles.ts'
import { ScrollAnchoringDetail, ScrollAnchoringReproduction } from './public/scroll-anchoring.tsx'

export function ScrollAnchoringPage() {
  return () => (
    <Document title="Scroll anchoring restoration" maxWidth="860px">
      <a href={routes.home.href()} mix={linkStyle}>
        ← Back to demos
      </a>
      <h1 mix={pageHeadingStyle}>Scroll anchoring restoration</h1>
      <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
        This isolates the case where reconciliation inserts content before a preserved client entry
        and browser scroll anchoring interferes with traversal restoration.
      </p>

      <ScrollAnchoringReproduction variant="list" />

      <section
        id="scroll-anchoring-list-end"
        mix={css({
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: 12,
          padding: 20,
          marginTop: 20,
          background: 'rgba(129,140,248,0.12)',
        })}
      >
        <h2 mix={css({ marginTop: 0, fontSize: 20 })}>End of the anchoring list</h2>
        <a
          href={routes.scrollAnchoringDetail.href()}
          mix={css({ color: '#ffffff', fontWeight: 700, textDecoration: 'underline' })}
        >
          Open the anchoring detail page →
        </a>
      </section>
    </Document>
  )
}

export function ScrollAnchoringDetailPage() {
  return () => (
    <Document title="Scroll anchoring restoration" maxWidth="860px">
      <a href={routes.home.href()} mix={linkStyle}>
        ← Back to demos
      </a>
      <h1 mix={pageHeadingStyle}>Scroll anchoring restoration</h1>
      <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
        The detail-only client entry below precedes the preserved collection entry.
      </p>

      <ScrollAnchoringDetail />
      <ScrollAnchoringReproduction variant="detail" />
    </Document>
  )
}
