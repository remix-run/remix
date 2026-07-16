import type { FormFailure } from 'remix/data-schema/form'
import type { TableRow } from 'remix/data-table'
import type { Handle } from 'remix/ui'

import {
  RegistrationFields,
  type RegistrationSubmission,
} from '../../assets/registration-fields.tsx'
import type { accounts } from '../../data/account.ts'
import * as styles from './styles.ts'

interface RegistrationPageProps {
  storedAccounts: Array<TableRow<typeof accounts>>
  submission?: FormFailure
}

export function RegistrationPage(handle: Handle<RegistrationPageProps>) {
  return () => {
    let { storedAccounts, submission } = handle.props

    return (
      <main mix={styles.page}>
        <header mix={styles.intro}>
          <p mix={styles.eyebrow}>Remix data model forms</p>
          <h1 mix={styles.heading}>Create an account from one data model.</h1>
          <p mix={styles.lede}>
            This page keeps its markup while the model supplies validation constraints, submitted
            value decoding, and server errors.
          </p>
          <ul mix={styles.featureList}>
            <li>The model-owned id is omitted from this form.</li>
            <li>The terms checkbox is ancillary UI data with its own schema.</li>
            <li>Native validation works before the browser runtime loads.</li>
          </ul>
        </header>

        <div mix={styles.workspace}>
          <RegistrationFields
            submission={submission ? getRegistrationSubmission(submission) : undefined}
          />
          <StoredAccounts accounts={storedAccounts} />
        </div>
      </main>
    )
  }
}

function getRegistrationSubmission(submission: FormFailure): RegistrationSubmission {
  return {
    values: { ...submission.values },
    errors: {
      fields: Object.fromEntries(
        Object.entries(submission.errors.fields).map(([field, errors]) => [field, [...errors]]),
      ),
      form: [...submission.errors.form],
    },
  }
}

interface StoredAccountsProps {
  accounts: ReadonlyArray<TableRow<typeof accounts>>
}

function StoredAccounts(handle: Handle<StoredAccountsProps>) {
  return () => {
    let { accounts } = handle.props

    return (
      <section aria-labelledby="stored-accounts-title" mix={[styles.panel, styles.databasePanel]}>
        <div mix={styles.databaseHeader}>
          <div>
            <p mix={styles.step}>Persistent data layer</p>
            <h2 id="stored-accounts-title" mix={styles.databaseHeading}>
              Stored in SQLite
            </h2>
          </div>
          <p mix={styles.databaseCount}>
            {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
          </p>
        </div>
        <p mix={styles.databaseDescription}>
          This in-memory database survives requests for the lifetime of this demo process. Passwords
          and the UI-only terms value are intentionally not stored.
        </p>
        {accounts.length === 0 ? (
          <p mix={styles.emptyDatabase}>No accounts have been stored yet.</p>
        ) : (
          <ol mix={styles.accountList}>
            {accounts.map((account) => (
              <li key={account.id} mix={styles.accountItem}>
                <h3 mix={styles.accountHeading}>{account.displayName}</h3>
                <dl mix={styles.resultList}>
                  <Result label="Email" value={account.email} />
                  <Result label="Age" value={account.age?.toString() ?? 'Not provided'} />
                  <Result label="Website" value={account.website ?? 'Not provided'} />
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>
    )
  }
}

interface ResultProps {
  label: string
  value: string
}

function Result(handle: Handle<ResultProps>) {
  return () => (
    <div mix={styles.resultItem}>
      <dt mix={styles.resultLabel}>{handle.props.label}</dt>
      <dd mix={styles.resultValue}>{handle.props.value}</dd>
    </div>
  )
}
