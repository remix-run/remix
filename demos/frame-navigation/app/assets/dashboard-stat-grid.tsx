import { clientEntry, css, link, type Handle } from 'remix/component'

type StatCard = {
  label: string
  value: string
  href: string
}

type DashboardStatGridProps = {
  cards: StatCard[]
}

export let DashboardStatGrid = clientEntry(
  '/assets/dashboard-stat-grid.js#DashboardStatGrid',
  function DashboardStatGrid(_handle: Handle) {
    return ({ cards }: DashboardStatGridProps) => (
      <div mix={statsGridStyle}>
        {cards.map((card) => (
          <article mix={[statCardStyle, link(card.href)]}>
            <p mix={statLabelStyle}>{card.label}</p>
            <p mix={statValueStyle}>{card.value}</p>
          </article>
        ))}
      </div>
    )
  },
)

let statsGridStyle = css({
  marginTop: '1.25rem',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '0.75rem',
})

let statCardStyle = css({
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '1rem',
  backgroundColor: '#ffffff',
  cursor: 'pointer',
  transition: 'border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease',
  '&:hover': {
    borderColor: '#94a3b8',
    transform: 'translateY(-1px)',
  },
  '&:focus-visible': {
    outline: '2px solid #2563eb',
    outlineOffset: '2px',
    borderColor: '#2563eb',
  },
})

let statLabelStyle = css({
  margin: 0,
  fontSize: '0.875rem',
  color: '#64748b',
})

let statValueStyle = css({
  margin: '0.3rem 0 0',
  fontSize: '1.5rem',
  fontWeight: 700,
})
