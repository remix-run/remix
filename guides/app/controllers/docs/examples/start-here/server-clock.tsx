import { css } from 'remix/ui'
import type { Handle } from 'remix/ui'

import type { AppContext } from '../../../../middleware/render.ts'
import { RefreshFrameButton } from './client.tsx'

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

const frameResponseInit = {
  headers: {
    'Cache-Control': 'no-store',
  },
} satisfies ResponseInit

export async function handler({ render, request }: AppContext) {
  let now = new Date()
  let url = new URL(request.url)

  return render(
    <ServerClockFrame
      generatedAt={now.toISOString()}
      generatedLabel={timeFormatter.format(now)}
      pathname={url.pathname}
    />,
    frameResponseInit,
  )
}

function ServerClockFrame(
  handle: Handle<{ generatedAt: string; generatedLabel: string; pathname: string }>,
) {
  return () => (
    <div mix={exampleCardStyles}>
      <p mix={exampleKickerStyles}>Frame route</p>
      <p mix={exampleClockStyles}>
        <time dateTime={handle.props.generatedAt}>{handle.props.generatedLabel}</time>
      </p>
      <p>
        This HTML came from <code>{handle.props.pathname}</code>. Reloading the frame fetches that
        route again and diffs the new HTML into this spot.
      </p>
      <RefreshFrameButton label="Refresh this frame" />
    </div>
  )
}

const exampleCardStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  margin: '1.5rem 0',
  padding: '1rem',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  background: 'var(--bg-subtle)',
  '& p': {
    margin: '0',
  },
})

const exampleKickerStyles = css({
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--fg-muted)',
})

const exampleClockStyles = css({
  fontSize: '2rem',
  fontWeight: '800',
  lineHeight: '1',
  letterSpacing: '-0.03em',
})
