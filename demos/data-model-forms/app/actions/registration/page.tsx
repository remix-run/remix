import type { FormFailure } from 'remix/data-schema/form'
import type { Handle, RemixNode } from 'remix/ui'

import {
  RegistrationFields,
  type RegistrationSubmission,
} from '../../assets/registration-fields.tsx'
import type { AssetEntryValue } from '../../middleware/asset-entry.ts'
import { routes } from '../../routes.ts'
import * as styles from './styles.ts'

interface RegistrationPageProps {
  assetEntry: AssetEntryValue
  submission?: FormFailure
}

export function RegistrationPage(handle: Handle<RegistrationPageProps>) {
  return () => {
    let { assetEntry, submission } = handle.props

    return (
      <Document assetEntry={assetEntry} title="Model-backed forms">
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

          <RegistrationFields
            submission={submission ? getRegistrationSubmission(submission) : undefined}
          />
        </main>
      </Document>
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

interface RegistrationSuccessPageProps {
  assetEntry: AssetEntryValue
  registration: {
    displayName: string
    email: string
    age: number | undefined
    website: string | undefined
    terms: boolean
  }
}

export function RegistrationSuccessPage(handle: Handle<RegistrationSuccessPageProps>) {
  return () => {
    let { assetEntry, registration } = handle.props

    return (
      <Document assetEntry={assetEntry} title="Valid account">
        <main mix={styles.successPage}>
          <section aria-labelledby="success-title" mix={styles.successPanel}>
            <p mix={styles.eyebrow}>Server validation passed</p>
            <h1 id="success-title" mix={styles.successHeading}>
              The payload is typed and ready to use.
            </h1>
            <p mix={styles.lede}>
              The password was validated but is deliberately not rendered in this response.
            </p>
            <dl mix={styles.resultList}>
              <Result label="Display name" value={registration.displayName} />
              <Result label="Email" value={registration.email} />
              <Result label="Age" value={registration.age?.toString() ?? 'Not provided'} />
              <Result label="Website" value={registration.website ?? 'Not provided'} />
              <Result label="Terms accepted" value={registration.terms ? 'Yes' : 'No'} />
            </dl>
            <a href={routes.registration.index.href()} mix={styles.tryAgainLink}>
              Try another submission
            </a>
          </section>
        </main>
      </Document>
    )
  }
}

interface DocumentProps {
  assetEntry: AssetEntryValue
  children?: RemixNode
  title: string
}

function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { assetEntry, children, title } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          {assetEntry.scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script async type="module" src={assetEntry.scriptSrc} />
        </head>
        <body mix={styles.body}>{children}</body>
      </html>
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
