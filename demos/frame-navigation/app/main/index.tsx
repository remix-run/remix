import { css } from 'remix/component'

import { DashboardStatGrid } from '../assets/dashboard-stat-grid.tsx'
import { routes } from '../../config/routes.ts'

let statCards = [
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
    href: routes.main.account.href(),
  },
]

export function MainIndexPage() {
  return () => (
    <section>
      <h1 mix={titleStyle}>Learning dashboard</h1>
      <p mix={descriptionStyle}>
        Keep up with coursework, deadlines, and instructor updates from one central place.
      </p>

      <DashboardStatGrid cards={statCards} />

      <p mix={hintStyle}>Try tabbing to a card, pressing Enter, or Cmd/Ctrl-clicking one.</p>
    </section>
  )
}

let titleStyle = css({
  marginTop: 0,
  fontSize: '1.8rem',
  color: '#0f172a',
})

let descriptionStyle = css({
  marginTop: '0.5rem',
  color: '#475569',
  lineHeight: 1.7,
  maxWidth: '65ch',
})

let hintStyle = css({
  marginTop: '0.85rem',
  color: '#64748b',
  fontSize: '0.9rem',
})
