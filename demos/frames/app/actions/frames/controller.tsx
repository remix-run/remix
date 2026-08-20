import { createController, type RouterTypes } from 'remix/router'
import { Frame, css, type RemixNode } from 'remix/ui'

import { Counter } from '../../ui/public/counter.tsx'
import { ReloadScope } from '../../ui/public/reload-scope.tsx'
import { ScrollRestorationList } from '../public/scroll-restoration.tsx'
import { ReloadTime } from './public/reload-time.tsx'
import { routes } from '../../routes.ts'
import { clockLabelStyle, leadStyle, mutedStyle } from '../../ui/public/styles.ts'
import { searchUnitedStates } from '../../utils/us-states.ts'

export const framesController = createController(routes.frames, {
  actions: {
    async sidebar(context) {
      await delay(400)

      return render(
        context,
        <div>
          <p mix={leadStyle}>
            This content is rendered by <code>/frames/sidebar</code>.
          </p>
          <ul mix={listStyle}>
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
        context,
        <div>
          <p mix={leadStyle}>
            Rendered by <code>/frames/activity</code> at{' '}
            <time>{new Date().toLocaleTimeString()}</time>.
          </p>
          <Frame
            src={routes.frames.activityDetail.href()}
            fallback={<div mix={mutedStyle}>Loading detail…</div>}
          />
        </div>,
      )
    },

    async activityDetail(context) {
      await delay(600)

      return render(
        context,
        <div>
          <p mix={[mutedStyle, css({ marginTop: 0, marginBottom: 8 })]}>
            Nested frame with a hydrated counter:
          </p>
          <div mix={css({ marginTop: 12 })}>
            <Frame
              src={routes.frames.time.href()}
              fallback={<div mix={mutedStyle}>Loading server time…</div>}
            />
          </div>
        </div>,
      )
    },

    async clientFrameExample(context) {
      await delay(500)

      return render(
        context,
        <div mix={fragmentStyle}>
          <div mix={fragmentLabelStyle}>Server fragment from /frames/client-frame-example</div>
          <div mix={clockValueStyle}>{new Date().toLocaleTimeString()}</div>
          <div mix={css({ marginTop: 8 })}>
            <Counter initialCount={5} label="Inside mounted frame" />
          </div>
          <div mix={css({ marginTop: 10 })}>
            <div mix={nestedFrameLabelStyle}>Nested frame:</div>
            <Frame
              src={routes.frames.clientFrameExampleNested.href()}
              fallback={<div mix={mutedStyle}>Loading nested frame…</div>}
            />
          </div>
        </div>,
      )
    },

    async clientFrameExampleNested(context) {
      await delay(350)

      return render(
        context,
        <div mix={nestedFragmentStyle}>
          <div mix={fragmentLabelStyle}>Nested server fragment</div>
          <div mix={css({ marginTop: 6 })}>
            <Counter initialCount={1} label="Nested frame counter" />
          </div>
        </div>,
      )
    },

    async clientMountedOuter(context) {
      await delay(350)

      return render(
        context,
        <div mix={fragmentStyle}>
          <div mix={fragmentLabelStyle}>
            Outer server fragment from /frames/client-mounted-outer
          </div>
          <div mix={css({ marginTop: 8 })}>
            <Counter initialCount={2} label="Outer frame counter" />
          </div>
          <div mix={css({ marginTop: 10 })}>
            <div mix={nestedFrameLabelStyle}>Nested non-blocking frame:</div>
            <Frame
              src={routes.frames.clientMountedNested.href()}
              fallback={<div mix={mutedStyle}>Loading nested non-blocking frame…</div>}
            />
          </div>
        </div>,
      )
    },

    async clientMountedNested(context) {
      await delay(2200)

      return render(
        context,
        <div mix={nestedFragmentStyle}>
          <div mix={fragmentLabelStyle}>Nested server fragment</div>
          <div mix={clockValueStyle}>{new Date().toLocaleTimeString()}</div>
          <div mix={css({ marginTop: 6 })}>
            <Counter initialCount={3} label="Nested frame counter" />
          </div>
        </div>,
      )
    },

    async rootReloadEntryFrame(context) {
      await delay(700)

      return render(
        context,
        <div mix={fragmentStyle}>
          <div mix={fragmentLabelStyle}>Frame inside preserved client entry</div>
          <div mix={clockValueStyle}>{new Date().toLocaleTimeString()}</div>
          <div mix={css({ marginTop: 8 })}>
            <Counter initialCount={10} label="Nested frame" />
          </div>
        </div>,
      )
    },

    async time(context) {
      await delay(1200)

      let now = new Date()

      return render(
        context,
        <div>
          <div
            mix={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            })}
          >
            <div>
              <div mix={clockLabelStyle}>Server time</div>
              <div mix={largeClockValueStyle}>{now.toLocaleTimeString()}</div>
            </div>
            <Counter initialCount={0} label="In a frame" />
            <div mix={css({ display: 'flex', flexDirection: 'column', gap: 12 })}>
              <ReloadTime />
            </div>
          </div>
        </div>,
      )
    },

    async reloadScope(context) {
      await delay(700)

      return renderReloadScopeFrame(context, 'Non-blocking frame server time')
    },

    async reloadScopeBlocking(context) {
      await delay(500)

      return renderReloadScopeFrame(context, 'Blocking frame server time')
    },

    async scrollRestorationItems(context) {
      return render(context, <ScrollRestorationList loadedAt={new Date().toLocaleTimeString()} />)
    },

    async stateSearchResults(context) {
      await delay(300)

      let query = (context.url.searchParams.get('query') ?? '').trim()
      let matches = searchUnitedStates(query)

      return render(
        context,
        <div>
          <p mix={[leadStyle, css({ marginBottom: 10 })]}>
            {query
              ? `Results for "${query}" (${matches.length})`
              : `Showing all states (${matches.length})`}
          </p>
          {matches.length > 0 ? (
            <ul mix={[listStyle, css({ display: 'grid', gap: 4 })]}>
              {matches.map((state) => (
                <li key={state}>{state}</li>
              ))}
            </ul>
          ) : (
            <p mix={[mutedStyle, css({ margin: 0 })]}>No states matched that query.</p>
          )}
        </div>,
      )
    },
  },
})

function render(context: RouterTypes['context'], node: RemixNode, init?: ResponseInit) {
  return context.render(node, init)
}

function renderReloadScopeFrame(context: RouterTypes['context'], label: string) {
  let now = new Date()

  return render(
    context,
    <div>
      <div mix={clockLabelStyle}>{label}</div>
      <div mix={[largeClockValueStyle, css({ marginBottom: 10 })]}>{now.toLocaleTimeString()}</div>
      <ReloadScope />
    </div>,
  )
}

function delay(ms: number) {
  if (process.env.NODE_ENV === 'test') {
    ms = 10
  }

  return new Promise((resolve) => setTimeout(resolve, ms))
}

const listStyle = css({ margin: 0, paddingLeft: 18, color: '#e9eefc' })

const fragmentStyle = css({
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10,
  padding: 10,
  background: 'rgba(255,255,255,0.02)',
})

const nestedFragmentStyle = css({
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 8,
  padding: 8,
  background: 'rgba(255,255,255,0.02)',
})

const fragmentLabelStyle = css({ fontSize: 12, color: '#b9c6ff' })

const nestedFrameLabelStyle = css({
  fontSize: 12,
  color: '#9aa8e8',
  marginBottom: 6,
})

const clockValueStyle = css({
  fontSize: 16,
  fontVariantNumeric: 'tabular-nums',
  marginTop: 2,
})

const largeClockValueStyle = css({
  fontSize: 18,
  fontVariantNumeric: 'tabular-nums',
})
