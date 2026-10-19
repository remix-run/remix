import type { TableRow } from 'remix/data-table'
import type { Handle, RemixNode } from 'remix/component'

import type { accounts } from '../data/account.ts'
import { routes } from '../routes.ts'
import * as styles from './public/styles.ts'

interface ExamplePageProps {
  active: 'schema' | 'fields' | 'extra-fields' | 'inline'
  title: string
  description: string
  code: string
  storedAccounts: ReadonlyArray<TableRow<typeof accounts>>
  children: RemixNode
}

export function ExamplePage(handle: Handle<ExamplePageProps>) {
  return () => {
    let { active, title, description, code, storedAccounts, children } = handle.props

    return (
      <main mix={styles.page}>
        <header mix={styles.intro}>
          <p mix={styles.eyebrow}>Remix data model forms</p>
          <h1 mix={styles.heading}>{title}</h1>
          <p mix={styles.lede}>{description}</p>
          <nav aria-label="Form examples" mix={styles.navigation}>
            <a
              href={routes.schema.index.href()}
              aria-current={active === 'schema' ? 'page' : undefined}
            >
              1. One object schema
            </a>
            <a
              href={routes.fields.index.href()}
              aria-current={active === 'fields' ? 'page' : undefined}
            >
              2. Independent fields
            </a>
            <a
              href={routes['extra-fields'].index.href()}
              aria-current={active === 'extra-fields' ? 'page' : undefined}
            >
              3. Schema + extra fields
            </a>
            <a
              href={routes.inline.index.href()}
              aria-current={active === 'inline' ? 'page' : undefined}
            >
              4. All inline schemas
            </a>
          </nav>
          <p mix={styles.step}>Setup excerpt</p>
          <pre mix={styles.code}>
            <code>{code}</code>
          </pre>
          <ul mix={styles.featureList}>
            <li>Native constraints work without JavaScript.</li>
            <li>Client feedback appears after blur, then updates as you type.</li>
            <li>Failed submissions restore values and accessible errors.</li>
          </ul>
        </header>
        <div mix={styles.workspace}>
          {children}
          <StoredAccounts accounts={storedAccounts} />
        </div>
      </main>
    )
  }
}

function StoredAccounts(handle: Handle<{ accounts: ReadonlyArray<TableRow<typeof accounts>> }>) {
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
          All four examples write to the same in-memory database. Data survives requests for the
          lifetime of this demo process. Passwords and terms are never stored.
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

function Result(handle: Handle<{ label: string; value: string }>) {
  return () => (
    <div mix={styles.resultItem}>
      <dt mix={styles.resultLabel}>{handle.props.label}</dt>
      <dd mix={styles.resultValue}>{handle.props.value}</dd>
    </div>
  )
}
