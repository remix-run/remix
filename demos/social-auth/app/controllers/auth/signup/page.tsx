import { EmailIcon, PasswordIcon, UserIcon } from '../../ui/icons.tsx'
import { TextField } from '../../ui/form-field.tsx'
import { Footer } from '../footer.tsx'
import { AuthCard } from '../../ui/auth-card.tsx'
import { Document } from '../../ui/document.tsx'
import { Notice } from '../../ui/notice.tsx'
import * as styles from '../../ui/styles.ts'

export interface SignupPageProps {
  formAction: string
  loginHref: string
  error?: string
  values?: {
    name?: string
    email?: string
  }
}

export function SignupPage() {
  return ({ formAction, loginHref, error, values }: SignupPageProps) => (
    <Document title="Create Account">
      <AuthCard
        title="Create Account"
        subtitle="Sign up with email and password"
        footer={<Footer prefix="Already have an account?" href={loginHref} label="Sign in" />}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}

        <form method="POST" action={formAction} mix={styles.form}>
          <TextField
            id="name"
            name="name"
            type="text"
            label="Name"
            placeholder="Enter your name"
            autoComplete="name"
            defaultValue={values?.name}
            required
            icon={<UserIcon mix={styles.fieldIcon} />}
          />

          <TextField
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="Enter your email"
            autoComplete="email"
            defaultValue={values?.email}
            required
            icon={<EmailIcon mix={styles.fieldIcon} />}
          />

          <TextField
            id="password"
            name="password"
            type="password"
            label="Password"
            placeholder="Create a password"
            autoComplete="new-password"
            required
            icon={<PasswordIcon mix={styles.fieldIcon} />}
          />

          <button type="submit" mix={styles.submitButton}>
            Create Account
          </button>
        </form>
      </AuthCard>
    </Document>
  )
}
