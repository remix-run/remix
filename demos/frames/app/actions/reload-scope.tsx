import { Frame, type Handle } from 'remix/ui'

import { Counter } from '../assets/counter.tsx'
import { ReloadTopFrame } from '../assets/reload-scope.tsx'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'

export function ReloadScopePage(handle: Handle<{ pageNow: Date }>) {
  return () => (
    <Document title="Frame vs top reload">
      <a href={routes.home.href()} style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
        ← Back
      </a>
      <h1 style={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
        Frame reload vs top reload
      </h1>
      <p style={{ marginTop: 0, color: '#b9c6ff' }}>
        Compare blocking and non-blocking child frames while reloading either a child frame or the
        entire runtime tree.
      </p>
      <div
        style={{
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: 16,
          background: 'rgba(255,255,255,0.04)',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13, color: '#b9c6ff', marginBottom: 8 }}>
          Root client entry state
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Counter initialCount={0} label="Root" />
          <ReloadTopFrame />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: '#b9c6ff' }}>Page server time</div>
        <div style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
          {handle.props.pageNow.toLocaleTimeString()}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        <section
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: 16,
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Non-blocking child frame</h2>
          <Frame
            name="reload-scope-non-blocking"
            src={routes.frames.reloadScope.href()}
            fallback={<div style={{ color: '#9aa8e8' }}>Loading non-blocking frame…</div>}
          />
        </section>
        <section
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: 16,
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Blocking child frame</h2>
          <Frame name="reload-scope-blocking" src={routes.frames.reloadScopeBlocking.href()} />
        </section>
      </div>
    </Document>
  )
}
