import { createAction } from 'remix/router'
import { css, type Handle } from 'remix/ui'

import {
  PersistentRootReloadEntry,
  RemovableRootReloadEntry,
  RootReloadControls,
} from '../assets/root-reload-client-entries.tsx'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import {
  leadStyle,
  linkStyle,
  mutedStyle,
  pageHeadingStyle,
  sectionHeadingStyle,
} from '../ui/styles.ts'

export const rootReloadClientEntriesAction = createAction(routes.rootReloadClientEntries, {
  async handler({ render, url }) {
    await delay(1000)

    let includeRemoved = url.searchParams.get('removed') !== '0'
    let serverVersion = new Date().toLocaleTimeString()

    return render(
      <RootReloadClientEntriesPage
        includeRemoved={includeRemoved}
        serverVersion={serverVersion}
        withRemovedHref={routes.rootReloadClientEntries.href(undefined, {
          searchParams: { removed: '1' },
        })}
        withoutRemovedHref={routes.rootReloadClientEntries.href(undefined, {
          searchParams: { removed: '0' },
        })}
      />,
    )
  },
})

type RootReloadClientEntriesPageProps = {
  includeRemoved: boolean
  serverVersion: string
  withRemovedHref: string
  withoutRemovedHref: string
}

function RootReloadClientEntriesPage(handle: Handle<RootReloadClientEntriesPageProps>) {
  return () => (
    <Document title="Root reload client entries" maxWidth="860px">
      <a href={routes.home.href()} mix={linkStyle}>
        ← Back
      </a>
      <h1 mix={pageHeadingStyle}>Root reload client entries</h1>
      <p mix={leadStyle}>
        Use the buttons below to reload the root document frame with new server props, either
        keeping all client entries or removing one entry from the next HTML payload.
      </p>

      <RootReloadControls
        includeRemoved={handle.props.includeRemoved}
        serverVersion={handle.props.serverVersion}
        withRemovedHref={handle.props.withRemovedHref}
        withoutRemovedHref={handle.props.withoutRemovedHref}
      />

      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          marginTop: 20,
        })}
      >
        <PersistentRootReloadEntry serverVersion={handle.props.serverVersion} />
        {handle.props.includeRemoved ? (
          <RemovableRootReloadEntry serverVersion={handle.props.serverVersion} />
        ) : (
          <section
            mix={css({
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: 16,
              background: 'rgba(255,255,255,0.03)',
            })}
          >
            <h2 mix={sectionHeadingStyle}>Removed entry slot</h2>
            <p id="removed-entry-replacement" mix={[mutedStyle, css({ marginBottom: 0 })]}>
              The removable client entry is absent from this server response.
            </p>
          </section>
        )}
      </div>
    </Document>
  )
}

function delay(ms: number) {
  if (process.env.NODE_ENV === 'test') {
    ms = 10
  }

  return new Promise((resolve) => setTimeout(resolve, ms))
}
