import { css } from 'remix/component'

import { EmailIcon } from '../../../ui/icons.tsx'
import { TextField } from '../../../ui/form-field.tsx'
import { Footer } from '../footer.tsx'
import { designSystem } from '../../../ui/design-system.ts'
import { AuthCard } from '../../../ui/auth-card.tsx'
import { Document } from '../../../ui/document.tsx'
import { Notice } from '../../../ui/notice.tsx'
import * as styles from '../../../ui/styles.ts'

const { tokens } = designSystem

interface ForgotPasswordPageProps {
  formAction: string
  loginHref: string
  error?: string
  email?: string
}

export function ForgotPasswordPage() {
  return ({ formAction, loginHref, error, email }: ForgotPasswordPageProps) => (
    <Document title="Forgot Password">
      <AuthCard
        title="Forgot Password"
        subtitle="Enter your email and we will generate a reset link"
        footer={<Footer prefix="Remembered it?" href={loginHref} label="Back to sign in" />}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}

        <form method="POST" action={formAction} mix={styles.form}>
          <TextField
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="Enter your email"
            autoComplete="email"
            defaultValue={email}
            required
            icon={<EmailIcon mix={styles.fieldIcon} />}
          />

          <button type="submit" mix={styles.submitButton}>
            Send Reset Link
          </button>
        </form>
      </AuthCard>
    </Document>
  )
}

interface ForgotPasswordSentPageProps {
  email: string
  loginHref: string
  resetHref?: string
}

export function ForgotPasswordSentPage() {
  return ({ email, loginHref, resetHref }: ForgotPasswordSentPageProps) => (
    <Document title="Reset Link Ready">
      <AuthCard
        title="Check Your Email"
        subtitle={`If ${email} matches a local account, the demo generated a reset link.`}
      >
        <Notice tone="success">Password reset instructions are ready.</Notice>

        <div mix={styles.infoPanel}>
          <p mix={css({ marginBottom: tokens.space.sm })}>
            This demo does not send email. If a matching account exists, the reset URL is shown
            below.
          </p>
          {resetHref ? (
            <p>
              <a href={resetHref} mix={styles.helperLink}>
                {resetHref}
              </a>
            </p>
          ) : (
            <p>No matching local account was found.</p>
          )}
        </div>

        <div mix={styles.buttonRow}>
          {resetHref ? (
            <a href={resetHref} mix={styles.submitButton}>
              Open Reset Form
            </a>
          ) : null}
          <a href={loginHref} mix={styles.secondaryButton}>
            Back to Sign In
          </a>
        </div>
      </AuthCard>
    </Document>
  )
}
