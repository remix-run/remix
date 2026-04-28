import { Frame } from 'remix/ui'
import type { Controller } from 'remix/fetch-router'

import { Counter } from '../../assets/counter.tsx'
import { ReloadScope } from '../../assets/reload-scope.tsx'
import { ReloadTime } from '../../assets/reload-time.tsx'
import { routes } from '../../routes.ts'
import { render } from '../../utils/render.ts'
import { searchUnitedStates } from '../../utils/us-states.ts'

export const framesController = {
  actions: {
    async sidebar() {
      await delay(400)

      return render(
        <div>
          <p style={{ marginTop: 0, color: '#b9c6ff' }}>
            This content is rendered by <code>/frames/sidebar</code>.
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#e9eefc' }}>
            <li>Streams in after initial HTML</li>
            <li>Can contain client entries</li>
            <li>Can nest frames</li>
          </ul>
        </div>,
      )
    },

    async activity(context) {
      await delay(2000)

      return render(
        <div>
          <p style={{ marginTop: 0, color: '#b9c6ff' }}>
            Rendered by <code>/frames/activity</code> at{' '}
            <time>{new Date().toLocaleTimeString()}</time>.
          </p>
          <Frame
            src={routes.frames.activityDetail.href()}
            fallback={<div style={{ color: '#9aa8e8' }}>Loading detail…</div>}
          />
        </div>,
        { request: context.request, router: context.router },
      )
    },

    async activityDetail(context) {
      await delay(600)

      return render(
        <div>
          <p style={{ marginTop: 0, marginBottom: 8, color: '#9aa8e8' }}>
            Nested frame with a hydrated counter:
          </p>
          <div style={{ marginTop: 12 }}>
            <Frame
              src={routes.frames.time.href()}
              fallback={<div style={{ color: '#9aa8e8' }}>Loading server time…</div>}
            />
          </div>
        </div>,
        { request: context.request, router: context.router },
      )
    },

    async clientFrameExample(context) {
      await delay(500)

      return render(
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: 10,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontSize: 12, color: '#b9c6ff' }}>
            Server fragment from /frames/client-frame-example
          </div>
          <div style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
            {new Date().toLocaleTimeString()}
          </div>
          <div style={{ marginTop: 8 }}>
            <Counter initialCount={5} label="Inside mounted frame" />
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: '#9aa8e8', marginBottom: 6 }}>Nested frame:</div>
            <Frame
              src={routes.frames.clientFrameExampleNested.href()}
              fallback={<div style={{ color: '#9aa8e8' }}>Loading nested frame…</div>}
            />
          </div>
        </div>,
        { request: context.request, router: context.router },
      )
    },

    async clientFrameExampleNested() {
      await delay(350)

      return render(
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            padding: 8,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontSize: 12, color: '#b9c6ff' }}>Nested server fragment</div>
          <div style={{ marginTop: 6 }}>
            <Counter initialCount={1} label="Nested frame counter" />
          </div>
        </div>,
      )
    },

    async clientMountedOuter(context) {
      await delay(350)

      return render(
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: 10,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontSize: 12, color: '#b9c6ff' }}>
            Outer server fragment from /frames/client-mounted-outer
          </div>
          <div style={{ marginTop: 8 }}>
            <Counter initialCount={2} label="Outer frame counter" />
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: '#9aa8e8', marginBottom: 6 }}>
              Nested non-blocking frame:
            </div>
            <Frame
              src={routes.frames.clientMountedNested.href()}
              fallback={<div style={{ color: '#9aa8e8' }}>Loading nested non-blocking frame…</div>}
            />
          </div>
        </div>,
        { request: context.request, router: context.router },
      )
    },

    async clientMountedNested() {
      await delay(2200)

      return render(
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            padding: 8,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontSize: 12, color: '#b9c6ff' }}>Nested server fragment</div>
          <div style={{ fontSize: 16, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {new Date().toLocaleTimeString()}
          </div>
          <div style={{ marginTop: 6 }}>
            <Counter initialCount={3} label="Nested frame counter" />
          </div>
        </div>,
      )
    },

    async time() {
      await delay(1200)

      let now = new Date()

      return render(
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: '#b9c6ff' }}>Server time</div>
              <div style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
                {now.toLocaleTimeString()}
              </div>
            </div>
            <Counter initialCount={0} label="In a frame" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ReloadTime />
            </div>
          </div>
        </div>,
      )
    },

    async reloadScope() {
      await delay(700)

      let now = new Date()

      return render(
        <div>
          <div style={{ fontSize: 13, color: '#b9c6ff' }}>Frame server time</div>
          <div style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>
            {now.toLocaleTimeString()}
          </div>
          <ReloadScope />
        </div>,
      )
    },

    async stateSearchResults(context) {
      await delay(300)

      let query = (new URL(context.request.url).searchParams.get('query') ?? '').trim()
      let matches = searchUnitedStates(query)

      return render(
        <div>
          <p style={{ marginTop: 0, marginBottom: 10, color: '#b9c6ff' }}>
            {query
              ? `Results for "${query}" (${matches.length})`
              : `Showing all states (${matches.length})`}
          </p>
          {matches.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              {matches.map((state) => (
                <li key={state}>{state}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: '#9aa8e8' }}>No states matched that query.</p>
          )}
        </div>,
      )
    },
  },
} satisfies Controller<typeof routes.frames>

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
