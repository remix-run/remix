import { PasswordIcon } from '../shared/index.ts'
import { TextField } from '../shared/index.ts'
import { SimpleFooter } from './simple-footer.tsx'
import { AuthCard, Document, Notice } from '../shared/index.ts'
import * as styles from '../styles.ts'

export interface ResetPasswordPageProps {
  formAction: string
  loginHref: string
  error?: string
}

export function ResetPasswordPage() {
  return ({ formAction, loginHref, error }: ResetPasswordPageProps) => (
    <Document title="Reset Password">
      <AuthCard
        title="Reset Password"
        subtitle="Create a new password for your account"
        footer={<SimpleFooter prefix="Changed your mind?" href={loginHref} label="Back to sign in" />}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}

        <form method="POST" action={formAction} mix={styles.form}>
          <TextField
            id="password"
            name="password"
            type="password"
            label="New Password"
            placeholder="Enter a new password"
            autoComplete="new-password"
            required
            icon={<PasswordIcon mix={styles.fieldIcon} />}
          />

          <TextField
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirm Password"
            placeholder="Confirm your password"
            autoComplete="new-password"
            required
            icon={<PasswordIcon mix={styles.fieldIcon} />}
          />

          <button type="submit" mix={styles.submitButton}>
            Update Password
          </button>
        </form>
      </AuthCard>
    </Document>
  )
}

export interface ResetPasswordCompletePageProps {
  loginHref: string
}

export function ResetPasswordCompletePage() {
  return ({ loginHref }: ResetPasswordCompletePageProps) => (
    <Document title="Password Updated">
      <AuthCard title="Password Updated" subtitle="Your password has been changed successfully.">
        <Notice tone="success">You can sign in with your new password now.</Notice>
        <a href={loginHref} mix={styles.submitButton}>
          Back to Sign In
        </a>
      </AuthCard>
    </Document>
  )
}
