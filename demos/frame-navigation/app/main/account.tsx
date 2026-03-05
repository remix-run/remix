import { css } from 'remix/component'

export function MainAccountPage() {
  return () => (
    <section>
      <h1 mix={[titleStyle]}>Account</h1>
      <p mix={[descriptionStyle]}>Manage your profile, enrollment details, and contact preferences.</p>

      <dl mix={[detailsGridStyle]}>
        <dt mix={[termStyle]}>Name</dt>
        <dd mix={[definitionStyle]}>Riley Student</dd>
        <dt mix={[termStyle]}>Program</dt>
        <dd mix={[definitionStyle]}>Human Computer Interaction</dd>
        <dt mix={[termStyle]}>Expected graduation</dt>
        <dd mix={[definitionStyle]}>May 2027</dd>
      </dl>
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

let detailsGridStyle = css({
  marginTop: '1.25rem',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '1rem',
  display: 'grid',
  gridTemplateColumns: '150px 1fr',
  rowGap: '0.6rem',
})

let termStyle = css({
  color: '#64748b',
})

let definitionStyle = css({
  margin: 0,
  color: '#0f172a',
})
