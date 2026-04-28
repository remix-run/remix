import { css } from 'remix/ui'

export function MainCoursesPage() {
  return () => (
    <section>
      <h1 mix={titleStyle}>Courses</h1>
      <p mix={descriptionStyle}>Continue where you left off in each course track.</p>

      <ul mix={courseListStyle}>
        <li mix={courseItemStyle}>Introduction to Product Design</li>
        <li mix={courseItemStyle}>Applied Statistics for Engineers</li>
        <li mix={courseItemStyle}>Web Accessibility Foundations</li>
      </ul>
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

const courseListStyle = css({
  listStyle: 'none',
  margin: '1.25rem 0 0',
  padding: 0,
  display: 'grid',
  gap: '0.75rem',
})

const courseItemStyle = css({
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '0.9rem 1rem',
})
