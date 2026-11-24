import { css, type Handle } from 'remix/component'

import { getDepartures, type Departure } from '../data/board.ts'

export type BoardProps = {
  view: string
  connection: number
  event: number
  resumedFrom: string | null
}

const statusColors: Record<Departure['status'], string> = {
  'On time': '#1f9d55',
  Boarding: '#2563eb',
  Delayed: '#c2410c',
}

/**
 * One snapshot of the departure board, rendered into a single server-sent event.
 */
export function Board(handle: Handle<BoardProps>) {
  return () => {
    let { view, connection, event, resumedFrom } = handle.props

    return (
      <div>
        <div
          mix={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: '#0f172a',
            color: '#e2e8f0',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.8rem',
          })}
        >
          <span>view: {view}</span>
          <span>connection #{connection}</span>
          <span>event #{event}</span>
          <span>{resumedFrom ? `resumed from #${resumedFrom}` : 'first connection'}</span>
        </div>

        <table mix={css({ width: '100%', borderCollapse: 'collapse' })}>
          <thead>
            <tr mix={css({ textAlign: 'left', background: '#f1f5f9' })}>
              <th mix={css({ padding: '0.5rem 1rem' })}>Service</th>
              <th mix={css({ padding: '0.5rem 1rem' })}>Destination</th>
              <th mix={css({ padding: '0.5rem 1rem' })}>Platform</th>
              <th mix={css({ padding: '0.5rem 1rem' })}>Departs</th>
              <th mix={css({ padding: '0.5rem 1rem' })}>Status</th>
            </tr>
          </thead>
          <tbody>
            {getDepartures().map((departure) => (
              <tr key={departure.id} mix={css({ borderTop: '1px solid #e2e8f0' })}>
                <td mix={css({ padding: '0.5rem 1rem', fontFamily: 'ui-monospace, monospace' })}>
                  {departure.service}
                </td>
                <td mix={css({ padding: '0.5rem 1rem' })}>{departure.destination}</td>
                <td mix={css({ padding: '0.5rem 1rem' })}>{departure.platform}</td>
                <td mix={css({ padding: '0.5rem 1rem', fontVariantNumeric: 'tabular-nums' })}>
                  {formatCountdown(departure.departsIn)}
                </td>
                <td mix={css({ padding: '0.5rem 1rem', color: statusColors[departure.status] })}>
                  {departure.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <label
          mix={css({
            display: 'block',
            padding: '0.75rem 1rem',
            borderTop: '1px solid #e2e8f0',
            color: '#475569',
            fontSize: '0.85rem',
          })}
        >
          Scratch note
          <input
            name="note"
            placeholder="Type here. Updates arrive every second and leave this alone."
            mix={css({
              display: 'block',
              width: '100%',
              marginTop: '0.35rem',
              padding: '0.4rem 0.6rem',
              border: '1px solid #cbd5f5',
              borderRadius: '6px',
              font: 'inherit',
            })}
          />
        </label>
      </div>
    )
  }
}

function formatCountdown(seconds: number): string {
  let minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
