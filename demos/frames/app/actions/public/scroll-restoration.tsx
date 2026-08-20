import { clientEntry, css, on, type Handle } from 'remix/ui'

import { leadStyle, mutedStyle, panelStyle, sectionHeadingStyle } from '../../ui/public/styles.ts'

const listItems = Array.from({ length: 48 }, (_, index) => index + 1)

export const ScrollRestorationList = clientEntry(
  import.meta.url,
  function ScrollRestorationList(handle: Handle<{ loadedAt: string }>) {
    let interactions = 0

    return () => (
      <section id="scroll-restoration-list">
        <div
          mix={[
            panelStyle,
            css({
              position: 'sticky',
              top: 12,
              zIndex: 1,
              padding: 14,
              marginBottom: 12,
              background: '#151c35',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }),
          ]}
        >
          <strong>Blocking frame client entry</strong>
          <span mix={[mutedStyle, css({ marginLeft: 8 })]}>
            resolved at {handle.props.loadedAt}
          </span>
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
              List row {item}
            </li>
          ))}
        </ol>
      </section>
    )
  },
)

export const ScrollRestorationDetail = clientEntry(
  import.meta.url,
  function ScrollRestorationDetail(handle: Handle) {
    let interactions = 0

    return () => (
      <article
        id="scroll-restoration-detail"
        mix={[
          panelStyle,
          css({
            minHeight: 1400,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 20,
            marginTop: 20,
            background: 'rgba(255,255,255,0.03)',
          }),
        ]}
      >
        <div>
          <h2 mix={sectionHeadingStyle}>Hydrated detail content</h2>
          <button
            type="button"
            mix={on('click', () => {
              interactions++
              handle.update()
            })}
          >
            Hydration check: {interactions}
          </button>
        </div>
        <p mix={[leadStyle, css({ marginBottom: 0 })]}>
          You are near the end of the detail page. Use the browser Back button now.
        </p>
      </article>
    )
  },
)
