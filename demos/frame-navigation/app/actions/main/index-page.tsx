import { css } from 'remix/component'

import { DashboardStatGrid } from './public/dashboard-stat-grid.tsx'
import { routes } from '../../routes.ts'

const statCards = [
  {
    label: 'In progress',
    value: '4 courses',
    href: routes.main.courses.href(),
  },
  {
    label: 'Due this week',
    value: '7 tasks',
    href: routes.main.calendar.href(),
  },
  {
    label: 'Average grade',
    value: '92%',
    href: routes.main.account.index.href(),
  },
]

export function MainIndexPage() {
  return () => (
    <section>
      <h1
        mix={css({
          marginTop: 0,
          fontSize: '1.8rem',
          color: '#0f172a',
        })}
      >
        Learning dashboard
      </h1>
      <p
        mix={css({
          marginTop: '0.5rem',
          color: '#475569',
          lineHeight: 1.7,
          maxWidth: '65ch',
        })}
      >
        Keep up with coursework, deadlines, and instructor updates from one central place.
      </p>

      <DashboardStatGrid cards={statCards} />

      <p
        mix={css({
          marginTop: '0.85rem',
          color: '#64748b',
          fontSize: '0.9rem',
        })}
      >
        Try tabbing to a card, pressing Enter, or Cmd/Ctrl-clicking one.
      </p>
    </section>
  )
}
