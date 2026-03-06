import { clientEntry, Frame, css, on, type Handle } from 'remix/component'
import { routes } from '../routes.ts'

export let ClientMountedPageExample = clientEntry(
  '/assets/client-mounted-page-example.js#ClientMountedPageExample',
  (handle: Handle) => {
    let showFrame = false

    return () => (
      <section
        mix={[
          css({
            marginTop: 16,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: 12,
            background: 'rgba(255,255,255,0.03)',
          }),
        ]}
      >
        <div
          mix={[
            css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }),
          ]}
        >
          <div>
            <div mix={[css({ fontSize: 13, color: '#b9c6ff' })]}>Client-mounted frame test</div>
            <div mix={[css({ fontSize: 12, color: '#9aa8e8' })]}>
              Mount a frame whose server content includes a nested non-blocking frame.
            </div>
          </div>
          <button
            type="button"
            mix={[
              css({
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e9eefc',
                cursor: 'pointer',
                '&:hover': { background: 'rgba(255,255,255,0.10)' },
              }),
              on('click', () => {
                showFrame = !showFrame
                handle.update()
              }),
            ]}
          >
            {showFrame ? 'Remove Frame' : 'Mount Frame'}
          </button>
        </div>

        {showFrame ? (
          <div mix={[css({ marginTop: 10 })]}>
            <Frame
              src={routes.frames.clientMountedOuter.href()}
              fallback={<div mix={[css({ color: '#9aa8e8' })]}>Loading outer mounted frame…</div>}
            />
          </div>
        ) : null}
      </section>
    )
  },
)
