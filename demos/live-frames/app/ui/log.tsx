import { css, type Handle } from 'remix/component'

import type { LogLine } from '../data/log.ts'

const line = css({
  display: 'flex',
  gap: '0.75rem',
  padding: '0.4rem 1rem',
  borderTop: '1px solid #e2e8f0',
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.8rem',
})

const time = css({ color: '#64748b' })

/**
 * The log as it stands, sent as one snapshot when a frame connects.
 */
export function LogHistory(handle: Handle<{ lines: LogLine[]; resumedFrom: string | null }>) {
  return () => (
    <div>
      <p
        mix={css({
          padding: '0.75rem 1rem',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.8rem',
        })}
      >
        {handle.props.resumedFrom
          ? `reconnected, resumed from #${handle.props.resumedFrom}`
          : 'connected'}
      </p>
      {handle.props.lines.map((entry) => (
        <LogRow key={entry.id} line={entry} />
      ))}
    </div>
  )
}

/**
 * A single new line, sent on its own as an append event.
 */
export function LogRow(handle: Handle<{ line: LogLine }>) {
  return () => (
    <p data-line mix={line}>
      <span mix={time}>{handle.props.line.at}</span>
      <span>{handle.props.line.text}</span>
    </p>
  )
}
