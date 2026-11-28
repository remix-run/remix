import { css, type Handle } from 'remix/component'

import { DropButton } from '../ui/public/drop-button.tsx'
import { LiveFrame } from '../ui/public/live-frame.tsx'
import { Layout } from '../ui/layout.tsx'
import { routes } from '../routes.ts'

export function HomePage(handle: Handle) {
  return () => {
    let concourse = routes.board.href(null)
    let platform = routes.board.href(null, { searchParams: { view: 'platform' } })

    return (
      <Layout>
        <h1 mix={css({ fontSize: '1.6rem', marginBottom: '0.5rem' })}>Live Frames</h1>
        <p mix={css({ color: '#475569', marginBottom: '1.5rem' })}>
          Four frames, three sources, two ways to push. The boards replace their content with each
          event, so the countdowns tick without a reload while the scratch note keeps whatever you
          type into it. The log appends instead, so it only ever receives the line that is new.
        </p>

        <div
          mix={css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '2rem',
          })}
        >
          <DropButton src={routes.drop.href(null)} />
          <span mix={css({ color: '#475569', fontSize: '0.9rem' })}>
            The server hangs up, the frames reconnect on their own, and the board says which event
            they resumed from.
          </span>
        </div>

        <LiveFrame
          title="Concourse"
          note="Replace: every event carries the whole board, diffed into the page."
          src={concourse}
        />
        <LiveFrame
          title="Waiting room, same source"
          note="The same URL as the concourse board, so it shares that connection."
          src={concourse}
        />
        <LiveFrame
          title="Platform, a source of its own"
          note="A different URL, so it gets a connection of its own."
          src={platform}
        />
        <LiveFrame
          title="Operations log"
          note="Append: one snapshot on connect, then a line at a time. The count beside the heading comes from the frame's rmx:update event."
          src={routes.log.href(null)}
          follow
          count
        />

        <p mix={css({ color: '#475569', fontSize: '0.9rem' })}>
          The first two frames read the same URL, so they share one connection and show the same
          connection number. The third reads its own URL and gets its own. The log keeps everything
          it has rendered and only receives what is new.
        </p>
      </Layout>
    )
  }
}
