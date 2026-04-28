import { clientEntry, css, link, type Handle } from 'remix/component'

type StatCard = {
  label: string
  value: string
  href: string
}

type DashboardStatGridProps = {
  cards: StatCard[]
}

export const DashboardStatGrid = clientEntry(
  '/assets/dashboard-stat-grid.js#DashboardStatGrid',
  function DashboardStatGrid(handle: Handle<DashboardStatGridProps>) {
    return () => (
      <div mix={statsGridStyle}>
        {handle.props.cards.map((card) => (
          <article mix={[statCardStyle, link(card.href)]}>
            <p mix={statLabelStyle}>{card.label}</p>
            <p mix={statValueStyle}>{card.value}</p>
          </article>
        ))}
      </div>
    )
  },
)

const statsGridStyle = css({
  marginTop: '1.25rem',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '0.75rem',
})

const statCardStyle = css({
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

const statLabelStyle = css({
  margin: 0,
  fontSize: '0.875rem',
  color: '#64748b',
})

const statValueStyle = css({
  margin: '0.3rem 0 0',
  fontSize: '1.5rem',
  fontWeight: 700,
})
