import type { Action } from 'remix/fetch-router'
import type { Handle } from 'remix/ui'

import {
  PersistentRootReloadEntry,
  RemovableRootReloadEntry,
  RootReloadControls,
} from '../assets/root-reload-client-entries.tsx'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { render } from './render.ts'

export const rootReloadClientEntriesAction = {
  async handler(context) {
    await delay(1000)

    let url = new URL(context.request.url)
    let includeRemoved = url.searchParams.get('removed') !== '0'
    let serverVersion = new Date().toLocaleTimeString()

    return render(
      <RootReloadClientEntriesPage
        includeRemoved={includeRemoved}
        serverVersion={serverVersion}
        withRemovedHref={routes.rootReloadClientEntries.href(undefined, { removed: '1' })}
        withoutRemovedHref={routes.rootReloadClientEntries.href(undefined, { removed: '0' })}
      />,
      { request: context.request, router: context.router },
    )
  },
} satisfies Action<typeof routes.rootReloadClientEntries>

type RootReloadClientEntriesPageProps = {
  includeRemoved: boolean
  serverVersion: string
  withRemovedHref: string
  withoutRemovedHref: string
}

function RootReloadClientEntriesPage(handle: Handle<RootReloadClientEntriesPageProps>) {
  return () => (
    <Document title="Root reload client entries" maxWidth="860px">
      <a href={routes.home.href()} style={{ color: '#b9c6ff', textDecoration: 'underline' }}>
        ← Back
      </a>
      <h1 style={{ marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }}>
        Root reload client entries
      </h1>
      <p style={{ marginTop: 0, color: '#b9c6ff' }}>
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
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          marginTop: 20,
        }}
      >
        <PersistentRootReloadEntry serverVersion={handle.props.serverVersion} />
        {handle.props.includeRemoved ? (
          <RemovableRootReloadEntry serverVersion={handle.props.serverVersion} />
        ) : (
          <section
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: 16,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Removed entry slot</h2>
            <p id="removed-entry-replacement" style={{ marginBottom: 0, color: '#9aa8e8' }}>
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
