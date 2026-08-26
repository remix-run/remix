import { clientEntry, Frame, css, on, type Handle } from 'remix/ui'

import { routes } from '../../routes.ts'
import { leadStyle, mutedStyle, panelStyle, sectionHeadingStyle } from '../../ui/public/styles.ts'

const listItems = Array.from({ length: 48 }, (_, index) => index + 1)

export const ScrollAnchoringList = clientEntry(
  import.meta.url,
  function ScrollAnchoringList(handle: Handle<{ loadedAt: string }>) {
    return () => (
      <section id="scroll-anchoring-list">
        <p mix={mutedStyle}>Blocking frame resolved at {handle.props.loadedAt}</p>
        <ol mix={css({ display: 'grid', gap: 10, margin: 0, padding: 0, listStyle: 'none' })}>
          {listItems.map((item) => (
            <li
              key={item}
              mix={css({
                minHeight: 76,
                display: 'flex',
                alignItems: 'center',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '0 18px',
                background: item % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
              })}
            >
              Anchoring row {item}
            </li>
          ))}
        </ol>
      </section>
    )
  },
)

export const ScrollAnchoringReproduction = clientEntry(
  import.meta.url,
  function ScrollAnchoringReproduction(handle: Handle<{ variant: 'list' | 'detail' }>) {
    let interactions = 0

    return () => (
      <section id="scroll-anchoring-reproduction">
        <div
          mix={[
            panelStyle,
            css({
              position: 'sticky',
              top: 12,
              zIndex: 1,
              padding: 14,
              marginBottom: 20,
              background: '#151c35',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }),
          ]}
        >
          <strong>Preserved collection client entry</strong>
          <button
            type="button"
            mix={[
              on('click', () => {
                interactions++
                handle.update()
              }),
              css({ marginLeft: 12 }),
            ]}
          >
            Hydration check: {interactions}
          </button>
        </div>

        {handle.props.variant === 'list' ? (
          <Frame src={routes.frames.scrollAnchoringItems.href()} />
        ) : null}
      </section>
    )
  },
)

export const ScrollAnchoringDetail = clientEntry(import.meta.url, function ScrollAnchoringDetail() {
  return () => (
    <article
      mix={[
        panelStyle,
        css({
          minHeight: 1000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 20,
          background: 'rgba(255,255,255,0.03)',
        }),
      ]}
    >
      <div>
        <h2 mix={sectionHeadingStyle}>Scroll anchoring detail</h2>
        <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
          This detail-only client entry is inserted before the preserved collection entry.
        </p>
      </div>
      <p mix={[leadStyle, css({ marginBottom: 0 })]}>Use the browser Back button now.</p>
    </article>
  )
})
