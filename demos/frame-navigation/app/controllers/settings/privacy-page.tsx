import { css } from 'remix/component'

export function Privacy() {
  return () => (
    <section>
      <h2 mix={titleStyle}>Privacy</h2>
      <p mix={descriptionStyle}>
        Control what activity and profile details are visible to classmates and collaborators.
      </p>
      <div mix={cardStyle}>
        <p mix={rowStyle}>
          <span>Show course progress to classmates</span>
          <strong>Off</strong>
        </p>
        <p mix={rowStyle}>
          <span>Allow direct messages from peers</span>
          <strong>On</strong>
        </p>
        <p mix={rowStyle}>
          <span>Display email in group projects</span>
          <strong>Off</strong>
        </p>
      </div>
    </section>
  )
}

const titleStyle = css({
  margin: 0,
  fontSize: '1.5rem',
  color: '#0f172a',
})

const descriptionStyle = css({
  marginTop: '0.6rem',
  color: '#475569',
  lineHeight: 1.7,
})

const cardStyle = css({
  marginTop: '1rem',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  backgroundColor: '#ffffff',
  padding: '0.85rem 1rem',
  display: 'grid',
  gap: '0.7rem',
})

const rowStyle = css({
  margin: 0,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#0f172a',
})
