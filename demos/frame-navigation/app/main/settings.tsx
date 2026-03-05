import { css } from 'remix/component'

export function MainSettingsPage() {
  return () => (
    <section>
      <h1 mix={[titleStyle]}>Settings</h1>
      <p mix={[descriptionStyle]}>Configure notifications, privacy controls, and your learning preferences.</p>

      <div mix={[cardStyle]}>
        <p mix={[cardTitleStyle]}>Weekly digest emails</p>
        <p mix={[cardBodyStyle]}>You are subscribed to updates every Monday at 8:00 AM.</p>
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

let cardStyle = css({
  marginTop: '1.25rem',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '1rem',
  backgroundColor: '#ffffff',
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
