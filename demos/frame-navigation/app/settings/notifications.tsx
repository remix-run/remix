import { css } from 'remix/component'

export function SettingsNotificationsPage() {
  return () => (
    <section>
      <h2 mix={titleStyle}>Notifications</h2>
      <p mix={descriptionStyle}>
        Choose how and when you are notified about assignment deadlines, grade releases, and course
        announcements.
      </p>
      <ul mix={listStyle}>
        <li mix={rowStyle}>
          <span>Assignment due reminders</span>
          <strong>Enabled</strong>
        </li>
        <li mix={rowStyle}>
          <span>Weekly progress summary</span>
          <strong>Enabled</strong>
        </li>
        <li mix={rowStyle}>
          <span>Push notifications</span>
          <strong>Muted after 8PM</strong>
        </li>
      </ul>
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

let listStyle = css({
  listStyle: 'none',
  margin: '1rem 0 0',
  padding: 0,
  display: 'grid',
  gap: '0.55rem',
})

let rowStyle = css({
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  padding: '0.85rem 1rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})
