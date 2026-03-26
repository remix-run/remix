import { css } from 'remix/component'

export function Profile() {
  return () => (
    <section>
      <h2 mix={titleStyle}>Profile</h2>
      <p mix={descriptionStyle}>Update personal details shown to instructors and classmates.</p>
      <dl mix={detailsStyle}>
        <dt mix={termStyle}>Display name</dt>
        <dd mix={valueStyle}>Riley Student</dd>
        <dt mix={termStyle}>Timezone</dt>
        <dd mix={valueStyle}>America/Los_Angeles</dd>
      </dl>
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
})

const detailsStyle = css({
  marginTop: '1rem',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  backgroundColor: '#ffffff',
  padding: '1rem',
  display: 'grid',
  gridTemplateColumns: '180px 1fr',
  rowGap: '0.6rem',
})

const termStyle = css({
  color: '#64748b',
})

const valueStyle = css({
  margin: 0,
  color: '#0f172a',
})
