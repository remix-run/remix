import { Frame } from 'remix/ui'

import { ClientFrameExample } from '../assets/client-frame-example.tsx'
import { Counter } from '../assets/counter.tsx'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'

export function HomePage() {
  return () => (
    <Document title="Frames + fetch-router demo" maxWidth="980px">
      <h1 style={{ margin: 0, letterSpacing: '-0.02em' }}>Full-stack Frames</h1>
      <p style={{ marginTop: 8, color: '#b9c6ff' }}>
        Server routes are handled by <code>remix/fetch-router</code>; UI is streamed with{' '}
        <code>remix/ui</code> Frames and client entries.
      </p>
      <p style={{ marginTop: 0, marginBottom: 16 }}>
        <a href={routes.time.href()} style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
          Server time demo
        </a>
        {' · '}
        <a
          href={routes.reloadScope.href()}
          style={{ color: '#b9c6ff', textDecoration: 'underline' }}
        >
          Frame vs top reload demo
        </a>
        {' · '}
        <a
          href={routes.rootReloadClientEntries.href()}
          style={{ color: '#b9c6ff', textDecoration: 'underline' }}
        >
          Root reload client entries
        </a>
        {' · '}
        <a
          href={routes.stateSearch.href()}
          style={{ color: '#b9c6ff', textDecoration: 'underline' }}
        >
          Dynamic src search demo
        </a>
        {' · '}
        <a
          href={routes.clientMounted.href()}
          style={{ color: '#b9c6ff', textDecoration: 'underline' }}
        >
          Client-mounted nested frame demo
        </a>
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: 16,
          alignItems: 'start',
          marginTop: 24,
        }}
      >
        <aside
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: 16,
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Sidebar (Frame)</h2>
          <Frame
            src={routes.frames.sidebar.href()}
            fallback={<div style={{ color: '#9aa8e8' }}>Loading sidebar…</div>}
          />
        </aside>

        <main
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: 16,
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Main</h2>
          <p style={{ color: '#b9c6ff', marginTop: 0 }}>The counter below is a client entry.</p>
          <Counter initialCount={0} label="Clicks" />
          <ClientFrameExample />

          <div style={{ height: 16 }} />

          <h3 style={{ margin: 0, fontSize: 14, color: '#cfd8ff' }}>Activity (Frame)</h3>
          <Frame
            src={routes.frames.activity.href()}
            fallback={<div style={{ color: '#9aa8e8' }}>Loading activity…</div>}
          />
        </main>
      </div>
    </Document>
  )
}
