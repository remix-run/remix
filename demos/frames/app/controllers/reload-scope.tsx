import { Frame } from 'remix/component'
import type { BuildAction } from 'remix/fetch-router'

import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { render } from '../utils/render.ts'

export const reloadScopeAction = {
  handler(context) {
    let pageNow = new Date()

    return render(<ReloadScopePage pageNow={pageNow} />, {
      request: context.request,
      router: context.router,
    })
  },
} satisfies BuildAction<'GET', typeof routes.reloadScope>

function ReloadScopePage() {
  return ({ pageNow }: { pageNow: Date }) => (
    <Document title="Frame vs top reload">
      <a href={routes.home.href()} style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
        ← Back
      </a>
      <h1 style={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
        Frame reload vs top reload
      </h1>
      <p style={{ marginTop: 0, color: '#b9c6ff' }}>
        Reload only this frame, or reload the entire runtime tree from inside the same client entry.
      </p>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: '#b9c6ff' }}>Page server time</div>
        <div style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
          {pageNow.toLocaleTimeString()}
        </div>
      </div>
      <div
        style={{
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: 16,
          background: 'rgba(255,255,255,0.04)',
        }}
      >
        <Frame
          src={routes.frames.reloadScope.href()}
          fallback={<div style={{ color: '#9aa8e8' }}>Loading reload controls…</div>}
        />
      </div>
    </Document>
  )
}
