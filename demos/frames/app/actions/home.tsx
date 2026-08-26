import { Frame, css } from 'remix/ui'

import { ClientFrameExample } from '../ui/public/client-frame-example.tsx'
import { Counter } from '../ui/public/counter.tsx'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import {
  leadStyle,
  linkStyle,
  mutedStyle,
  panelStyle,
  sectionHeadingStyle,
} from '../ui/public/styles.ts'

export function HomePage() {
  return () => (
    <Document title="Frames + fetch-router demo" maxWidth="980px">
      <h1 mix={css({ margin: 0, letterSpacing: '-0.02em' })}>Full-stack Frames</h1>
      <p mix={css({ marginTop: 8, color: '#b9c6ff' })}>
        Server routes are handled by <code>remix/router</code>; UI is streamed with{' '}
        <code>remix/ui</code> Frames and client entries.
      </p>
      <p mix={css({ marginTop: 0, marginBottom: 16 })}>
        <a href={routes.time.href()} mix={linkStyle}>
          Server time demo
        </a>
        {' · '}
        <a href={routes.reloadScope.href()} mix={linkStyle}>
          Frame vs top reload demo
        </a>
        {' · '}
        <a href={routes.rootReloadClientEntries.href()} mix={linkStyle}>
          Root reload client entries
        </a>
        {' · '}
        <a href={routes.scrollRestoration.href()} mix={linkStyle}>
          Navigation scroll behavior
        </a>
        {' · '}
        <a href={routes.scrollAnchoring.href()} mix={linkStyle}>
          Scroll anchoring restoration
        </a>
        {' · '}
        <a href={routes.stateSearch.href()} mix={linkStyle}>
          Dynamic src search demo
        </a>
        {' · '}
        <a href={routes.clientMounted.href()} mix={linkStyle}>
          Client-mounted nested frame demo
        </a>
      </p>

      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: 16,
          alignItems: 'start',
          marginTop: 24,
        })}
      >
        <aside mix={panelStyle}>
          <h2 mix={sectionHeadingStyle}>Sidebar (Frame)</h2>
          <Frame
            src={routes.frames.sidebar.href()}
            fallback={<div mix={mutedStyle}>Loading sidebar…</div>}
          />
        </aside>

        <main mix={panelStyle}>
          <h2 mix={sectionHeadingStyle}>Main</h2>
          <p mix={leadStyle}>The counter below is a client entry.</p>
          <Counter initialCount={0} label="Clicks" />
          <ClientFrameExample />

          <div mix={css({ height: 16 })} />

          <h3 mix={css({ margin: 0, fontSize: 14, color: '#cfd8ff' })}>Activity (Frame)</h3>
          <Frame
            src={routes.frames.activity.href()}
            fallback={<div mix={mutedStyle}>Loading activity…</div>}
          />
        </main>
      </div>
    </Document>
  )
}
