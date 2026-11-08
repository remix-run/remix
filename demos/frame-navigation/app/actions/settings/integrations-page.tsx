import { css } from 'remix/component'

export function Integrations() {
  return () => (
    <section>
      <h2
        mix={css({
          margin: 0,
          fontSize: '1.5rem',
          color: '#0f172a',
        })}
      >
        Integrations
      </h2>
      <p
        mix={css({
          marginTop: '0.6rem',
          color: '#475569',
          lineHeight: 1.7,
        })}
      >
        Manage connected tools used for video conferencing, cloud storage, and assignment syncing.
      </p>
      <ul
        mix={css({
          listStyle: 'none',
          margin: '1rem 0 0',
          padding: 0,
          display: 'grid',
          gap: '0.55rem',
        })}
      >
        <li mix={integrationRowStyle}>
          <span>Zoom</span>
          <strong>Connected</strong>
        </li>
        <li mix={integrationRowStyle}>
          <span>Google Drive</span>
          <strong>Connected</strong>
        </li>
        <li mix={integrationRowStyle}>
          <span>Notion</span>
          <strong>Not Connected</strong>
        </li>
      </ul>
    </section>
  )
}

const integrationRowStyle = css({
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  padding: '0.85rem 1rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})
