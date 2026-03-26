import { css } from 'remix/component'

export function MainCalendarPage() {
  return () => (
    <section>
      <h1 mix={titleStyle}>Calendar</h1>
      <p mix={descriptionStyle}>Track class sessions, assignment due dates, and office hours.</p>

      <div mix={cardStyle}>
        <p mix={cardTitleStyle}>Today</p>
        <p mix={eventFirstStyle}>11:00 AM - UX Research Workshop</p>
        <p mix={eventNextStyle}>3:30 PM - Intro to Accessibility Quiz</p>
      </div>
    </section>
  )
}

const titleStyle = css({
  marginTop: 0,
  fontSize: '1.8rem',
  color: '#0f172a',
})

const descriptionStyle = css({
  marginTop: '0.5rem',
  color: '#475569',
  lineHeight: 1.7,
  maxWidth: '65ch',
})

const cardStyle = css({
  marginTop: '1.25rem',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '1rem',
  backgroundColor: '#ffffff',
})

const cardTitleStyle = css({
  margin: 0,
  fontWeight: 600,
  color: '#0f172a',
})

const eventFirstStyle = css({
  margin: '0.5rem 0 0',
  color: '#334155',
})

const eventNextStyle = css({
  margin: '0.35rem 0 0',
  color: '#334155',
})
