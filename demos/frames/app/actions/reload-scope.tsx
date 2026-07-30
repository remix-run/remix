import { Frame, css, type Handle } from 'remix/ui'

import { Counter } from '../assets/counter.tsx'
import { ReloadTopFrame } from '../assets/reload-scope.tsx'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import {
  clockLabelStyle,
  leadStyle,
  linkStyle,
  mutedStyle,
  pageHeadingStyle,
  panelStyle,
  sectionHeadingStyle,
} from '../ui/styles.ts'

export function ReloadScopePage(handle: Handle<{ pageNow: Date }>) {
  return () => (
    <Document title="Frame vs top reload">
      <a href={routes.home.href()} mix={linkStyle}>
        ← Back
      </a>
      <h1 mix={pageHeadingStyle}>Frame reload vs top reload</h1>
      <p mix={leadStyle}>
        Compare blocking and non-blocking child frames while reloading either a child frame or the
        entire runtime tree.
      </p>
      <div mix={[panelStyle, css({ marginBottom: 16 })]}>
        <div mix={[clockLabelStyle, css({ marginBottom: 8 })]}>Root client entry state</div>
        <div mix={css({ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' })}>
          <Counter initialCount={0} label="Root" />
          <ReloadTopFrame />
        </div>
      </div>
      <div mix={css({ marginBottom: 10 })}>
        <div mix={clockLabelStyle}>Page server time</div>
        <div mix={css({ fontSize: 20, fontVariantNumeric: 'tabular-nums' })}>
          {handle.props.pageNow.toLocaleTimeString()}
        </div>
      </div>
      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        })}
      >
        <section mix={panelStyle}>
          <h2 mix={sectionHeadingStyle}>Non-blocking child frame</h2>
          <Frame
            name="reload-scope-non-blocking"
            src={routes.frames.reloadScope.href()}
            fallback={<div mix={mutedStyle}>Loading non-blocking frame…</div>}
          />
        </section>
        <section mix={panelStyle}>
          <h2 mix={sectionHeadingStyle}>Blocking child frame</h2>
          <Frame name="reload-scope-blocking" src={routes.frames.reloadScopeBlocking.href()} />
        </section>
      </div>
    </Document>
  )
}
