import { css } from 'remix/component'

export function SettingsGradingPage() {
  return () => (
    <section>
      <h2 mix={titleStyle}>Grading</h2>
      <p mix={descriptionStyle}>
        Set grading display preferences and default rubric visibility for your courses.
      </p>
      <div mix={cardStyle}>
        <p mix={settingStyle}>
          <span>Default grade format</span>
          <strong>Percentage + Letter</strong>
        </p>
        <p mix={settingStyle}>
          <span>Show running course average</span>
          <strong>Enabled</strong>
        </p>
        <p mix={settingStyle}>
          <span>Rubric criteria expanded by default</span>
          <strong>Enabled</strong>
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
})

let cardStyle = css({
  marginTop: '1rem',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  backgroundColor: '#ffffff',
  padding: '0.85rem 1rem',
  display: 'grid',
  gap: '0.7rem',
})

let settingStyle = css({
  margin: 0,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#0f172a',
})
