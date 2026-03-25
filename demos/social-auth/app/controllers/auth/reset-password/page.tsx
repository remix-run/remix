import { PasswordIcon } from '../../../ui/icons.tsx'
import { TextField } from '../../../ui/form-field.tsx'
import { Footer } from '../footer.tsx'
import { AuthCard } from '../../../ui/auth-card.tsx'
import { Document } from '../../../ui/document.tsx'
import { Notice } from '../../../ui/notice.tsx'
import * as styles from '../../../ui/styles.ts'

interface ResetPasswordPageProps {
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
        footer={<Footer prefix="Changed your mind?" href={loginHref} label="Back to sign in" />}
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

interface ResetPasswordCompletePageProps {
  loginHref: string
}

export function ResetPasswordCompletePage() {
  return ({ loginHref }: ResetPasswordCompletePageProps) => (
    <Document title="Password Updated">
      <AuthCard title="Password Updated" subtitle="Your password has been changed successfully.">
        <Notice tone="success">You can sign in with your new password now.</Notice>

        <div mix={styles.buttonRow}>
          <a href={loginHref} mix={styles.submitButton}>
            Back to Sign In
          </a>
        </div>
      </AuthCard>
    </Document>
  )
}
