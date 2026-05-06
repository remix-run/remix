import { clientEntry, css, on, type Handle } from 'remix/ui'

type RootReloadControlsProps = {
  includeRemoved: boolean
  serverVersion: string
  withRemovedHref: string
  withoutRemovedHref: string
}

let persistentSetupCount = 0
let removableSetupCount = 0

export const RootReloadControls = clientEntry(
  '/assets/root-reload-client-entries.js#RootReloadControls',
  function RootReloadControls(handle: Handle<RootReloadControlsProps>) {
    let pendingHref: string | null = null
    let removedDisposeEvents = 0

    function handleRemovedDispose() {
      removedDisposeEvents++
      handle.update()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('root-reload-entry-disposed', handleRemovedDispose, {
        signal: handle.signal,
      })
    }

    async function reloadTopFrame(src: string) {
      if (pendingHref) return
      pendingHref = src
      await handle.update()

      handle.frames.top.src = src
      let signal = await handle.frames.top.reload()
      if (signal.aborted) return

      pendingHref = null
      handle.update()
    }

    return () => (
      <section
        mix={css({
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: 16,
          background: 'rgba(255,255,255,0.04)',
        })}
      >
        <h2 mix={css({ marginTop: 0, fontSize: 16 })}>Root reload controls</h2>
        <dl
          mix={css({
            display: 'grid',
            gridTemplateColumns: 'max-content 1fr',
            gap: '6px 12px',
            margin: '0 0 14px',
            color: '#b9c6ff',
          })}
        >
          <dt>Server props</dt>
          <dd mix={css({ margin: 0, color: '#e9eefc', fontVariantNumeric: 'tabular-nums' })}>
            {handle.props.serverVersion}
          </dd>
          <dt>Removable entry</dt>
          <dd mix={css({ margin: 0, color: '#e9eefc' })}>
            {handle.props.includeRemoved ? 'present' : 'absent'}
          </dd>
          <dt>Dispose events</dt>
          <dd mix={css({ margin: 0, color: '#e9eefc', fontVariantNumeric: 'tabular-nums' })}>
            {removedDisposeEvents}
          </dd>
        </dl>

        <div mix={css({ display: 'flex', gap: 8, flexWrap: 'wrap' })}>
          <button
            type="button"
            mix={[buttonStyle(), on('click', () => reloadTopFrame(handle.props.withRemovedHref))]}
            disabled={pendingHref !== null}
          >
            {pendingHref === handle.props.withRemovedHref
              ? 'Reloading with entry…'
              : 'Reload with removable entry'}
          </button>
          <button
            type="button"
            mix={[
              buttonStyle(),
              on('click', () => reloadTopFrame(handle.props.withoutRemovedHref)),
            ]}
            disabled={pendingHref !== null}
          >
            {pendingHref === handle.props.withoutRemovedHref
              ? 'Reloading without entry…'
              : 'Reload without removable entry'}
          </button>
        </div>
      </section>
    )
  },
)

export const PersistentRootReloadEntry = clientEntry(
  '/assets/root-reload-client-entries.js#PersistentRootReloadEntry',
  function PersistentRootReloadEntry(handle: Handle<{ serverVersion: string }>) {
    let setupId = 0
    let localCount = 0

    handle.queueTask(() => {
      setupId = ++persistentSetupCount
      handle.update()
    })

    return () => (
      <section mix={cardStyle()}>
        <h2 mix={css({ marginTop: 0, fontSize: 16 })}>Persistent entry</h2>
        <p mix={css({ marginTop: 0, color: '#b9c6ff' })}>
          This client entry should keep its setup and local state across root reloads while
          receiving fresh server props.
        </p>
        <EntryDetails
          setupId={setupId}
          localCount={localCount}
          serverVersion={handle.props.serverVersion}
        />
        <button
          type="button"
          mix={[
            buttonStyle(),
            on('click', () => {
              localCount++
              handle.update()
            }),
          ]}
        >
          Increment persistent count
        </button>
      </section>
    )
  },
)

export const RemovableRootReloadEntry = clientEntry(
  '/assets/root-reload-client-entries.js#RemovableRootReloadEntry',
  function RemovableRootReloadEntry(handle: Handle<{ serverVersion: string }>) {
    let setupId = 0
    let localCount = 0

    handle.queueTask(() => {
      setupId = ++removableSetupCount
      handle.update()
    })

    handle.signal.addEventListener('abort', () => {
      window.dispatchEvent(new CustomEvent('root-reload-entry-disposed'))
      console.info('[frames demo] removable root reload entry disposed')
    })

    return () => (
      <section mix={cardStyle()}>
        <h2 mix={css({ marginTop: 0, fontSize: 16 })}>Removable entry</h2>
        <p mix={css({ marginTop: 0, color: '#b9c6ff' })}>
          Reload without this entry. It should disappear and dispatch one dispose event.
        </p>
        <EntryDetails
          setupId={setupId}
          localCount={localCount}
          serverVersion={handle.props.serverVersion}
        />
        <button
          type="button"
          mix={[
            buttonStyle(),
            on('click', () => {
              localCount++
              handle.update()
            }),
          ]}
        >
          Increment removable count
        </button>
      </section>
    )
  },
)

function EntryDetails(
  handle: Handle<{ setupId: number; localCount: number; serverVersion: string }>,
) {
  return () => (
    <dl
      mix={css({
        display: 'grid',
        gridTemplateColumns: 'max-content 1fr',
        gap: '6px 12px',
        margin: '0 0 14px',
      })}
    >
      <dt mix={css({ color: '#b9c6ff' })}>Setup id</dt>
      <dd mix={css({ margin: 0, fontVariantNumeric: 'tabular-nums' })}>
        {handle.props.setupId === 0 ? 'hydrating' : handle.props.setupId}
      </dd>
      <dt mix={css({ color: '#b9c6ff' })}>Local count</dt>
      <dd mix={css({ margin: 0, fontVariantNumeric: 'tabular-nums' })}>
        {handle.props.localCount}
      </dd>
      <dt mix={css({ color: '#b9c6ff' })}>Server props</dt>
      <dd mix={css({ margin: 0, fontVariantNumeric: 'tabular-nums' })}>
        {handle.props.serverVersion}
      </dd>
    </dl>
  )
}

function buttonStyle() {
  return css({
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e9eefc',
    cursor: 'pointer',
    '&:hover': { background: 'rgba(255,255,255,0.10)' },
    '&:disabled': {
      cursor: 'default',
      opacity: 0.65,
    },
  })
}

function cardStyle() {
  return css({
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 16,
    background: 'rgba(255,255,255,0.03)',
  })
}
