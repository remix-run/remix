import { css } from 'remix/component'

export function MainIndexPage() {
  return () => (
    <section>
      <h1 mix={titleStyle}>Learning dashboard</h1>
      <p mix={descriptionStyle}>Keep up with coursework, deadlines, and instructor updates from one central place.</p>

      <div mix={statsGridStyle}>
        <article mix={statCardStyle}>
          <p mix={statLabelStyle}>In progress</p>
          <p mix={statValueStyle}>4 courses</p>
        </article>
        <article mix={statCardStyle}>
          <p mix={statLabelStyle}>Due this week</p>
          <p mix={statValueStyle}>7 tasks</p>
        </article>
        <article mix={statCardStyle}>
          <p mix={statLabelStyle}>Average grade</p>
          <p mix={statValueStyle}>92%</p>
        </article>
      </div>
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
