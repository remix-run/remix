import { css } from 'remix/ui'

import { Document } from './document.tsx'

export function AboutPage() {
  return () => (
    <Document>
      <main
        mix={css({
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        })}
      >
        <h1>About Us</h1>
      </main>
    </Document>
  )
}
