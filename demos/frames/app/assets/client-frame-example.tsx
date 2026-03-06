import { clientEntry, Frame, css, on, type Handle } from 'remix/component'

export let ClientFrameExample = clientEntry(
  '/assets/client-frame-example.js#ClientFrameExample',
  function ClientFrameExample(handle: Handle) {
    let mounted = false

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
            <div mix={[css({ fontSize: 13, color: '#b9c6ff' })]}>Client-rendered Frame</div>
            <div mix={[css({ fontSize: 12, color: '#9aa8e8' })]}>
              Added after hydration via a client entry component.
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
                mounted = !mounted
                handle.update()
              }),
            ]}
          >
            {mounted ? 'Remove Frame' : 'Mount Frame'}
          </button>
        </div>

        {mounted ? (
          <div mix={[css({ marginTop: 10 })]}>
            <Frame
              src="/frames/client-frame-example"
              fallback={<div mix={[css({ color: '#9aa8e8' })]}>Loading client frame content…</div>}
            />
          </div>
        ) : null}
      </section>
    )
  },
)
