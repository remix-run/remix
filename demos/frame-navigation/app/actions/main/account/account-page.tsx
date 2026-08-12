import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'

import type { Account } from '../../../data/account.ts'
import { frames, routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

type AccountDocumentProps = {
  title: string
  frameSrc: string
}

export function AccountDocument(handle: Handle<AccountDocumentProps>) {
  return () => (
    <Layout title={handle.props.title} activeNav="account">
      <Frame name={frames.account} src={handle.props.frameSrc} />
    </Layout>
  )
}

type AccountPageProps = {
  account: Account
  saved: boolean
}

export function AccountPage(handle: Handle<AccountPageProps>) {
  return () => {
    let { account, saved } = handle.props

    return (
      <section aria-labelledby="account-heading">
        <div mix={headingRowStyle}>
          <div>
            <h1 id="account-heading" mix={titleStyle}>
              Account
            </h1>
            <p mix={descriptionStyle}>
              Manage your profile, enrollment details, and contact preferences.
            </p>
          </div>
          <a
            href={routes.main.account.edit.index.href()}
            rmx-target={frames.account}
            mix={editLinkStyle}
          >
            Edit
          </a>
        </div>

        {saved ? (
          <p role="status" mix={successStyle}>
            Account saved
          </p>
        ) : null}

        <dl mix={detailsGridStyle}>
          <dt mix={termStyle}>Name</dt>
          <dd mix={definitionStyle}>{account.displayName}</dd>
          <dt mix={termStyle}>Program</dt>
          <dd mix={definitionStyle}>{account.program}</dd>
          <dt mix={termStyle}>Expected graduation</dt>
          <dd mix={definitionStyle}>{formatMonth(account.expectedGraduation)}</dd>
        </dl>
      </section>
    )
  }
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function formatMonth(value: string): string {
  let [year, month] = value.split('-')
  let monthName = monthNames[Number(month) - 1]
  return year && monthName ? `${monthName} ${year}` : value
}

const headingRowStyle = css({
  display: 'flex',
  alignItems: 'start',
  justifyContent: 'space-between',
  gap: '1rem',
})

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

const editLinkStyle = css({
  flexShrink: 0,
  color: '#4338ca',
  fontSize: '0.875rem',
  fontWeight: 700,
  textDecoration: 'none',
  '&:hover': {
    textDecoration: 'underline',
  },
})

const successStyle = css({
  width: 'fit-content',
  margin: '1rem 0 0',
  borderRadius: '999px',
  padding: '0.45rem 0.75rem',
  backgroundColor: '#dcfce7',
  color: '#166534',
  fontSize: '0.875rem',
  fontWeight: 700,
})

const detailsGridStyle = css({
  marginTop: '1.25rem',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '1rem',
  display: 'grid',
  gridTemplateColumns: '150px 1fr',
  rowGap: '0.6rem',
})

const termStyle = css({
  color: '#64748b',
})

const definitionStyle = css({
  margin: 0,
  color: '#0f172a',
})
