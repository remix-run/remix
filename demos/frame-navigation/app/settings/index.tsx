import { css } from 'remix/component'

export function SettingsIndexPage() {
  return () => (
    <section>
      <h2 mix={[titleStyle]}>Settings overview</h2>
      <p mix={[descriptionStyle]}>
        Configure your LMS experience, from profile details to grading visibility and connected
        learning tools.
      </p>
      <div mix={[cardStyle]}>
        <p mix={[cardTitleStyle]}>Recommended setup</p>
        <p mix={[cardBodyStyle]}>
          Complete profile, enable deadline reminders, and review privacy controls at least once
          this semester.
        </p>
      </div>
    </section>
  )
}

let titleStyle = css({
  margin: 0,
  fontSize: '1.5rem',
  color: '#0f172a',
})

let descriptionStyle = css({
  marginTop: '0.6rem',
  color: '#475569',
  lineHeight: 1.7,
  maxWidth: '70ch',
})

let cardStyle = css({
  marginTop: '1rem',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  backgroundColor: '#ffffff',
  padding: '1rem',
})

let cardTitleStyle = css({
  margin: 0,
  fontWeight: 600,
  color: '#0f172a',
})

let cardBodyStyle = css({
  margin: '0.5rem 0 0',
  color: '#64748b',
})
