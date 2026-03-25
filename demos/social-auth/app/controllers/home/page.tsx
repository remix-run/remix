import type { ExternalProviderLink } from '../../utils/external-auth.ts'
import { AuthCard } from '../../ui/auth-card.tsx'
import { Document } from '../../ui/document.tsx'
import { TextField } from '../../ui/form-field.tsx'
import { EmailIcon, PasswordIcon } from '../../ui/icons.tsx'
import { Notice } from '../../ui/notice.tsx'
import * as styles from '../../ui/styles.ts'
import { ExternalAuthSection } from './external-auth-section.tsx'
import { LoginFooter } from './footer.tsx'

interface LoginPageProps {
  formAction: string
  signupHref: string
  forgotPasswordHref: string
  providers: ExternalProviderLink[]
  error?: string
  success?: string
}

export function LoginPage() {
  return ({
    formAction,
    signupHref,
    forgotPasswordHref,
    providers,
    error,
    success,
  }: LoginPageProps) => (
    <Document title="Social Auth Demo">
      <AuthCard
        title="Welcome Back"
        subtitle="Sign in to your account"
        footer={<LoginFooter signupHref={signupHref} />}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
        {success ? <Notice tone="success">{success}</Notice> : null}

        <form method="POST" action={formAction} mix={styles.form}>
          <TextField
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="Enter your email"
            autoComplete="email"
            required
            icon={<EmailIcon mix={styles.fieldIcon} />}
          />

          <TextField
            id="password"
            name="password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            icon={<PasswordIcon mix={styles.fieldIcon} />}
          />

          <div mix={styles.formOptions}>
            <label mix={styles.rememberMe}>
              <input type="checkbox" name="remember" value="yes" mix={styles.rememberCheckbox} />
              <span>Remember me</span>
            </label>
            <a href={forgotPasswordHref} mix={styles.helperLink}>
              Forgot password?
            </a>
          </div>

          <button type="submit" mix={styles.submitButton}>
            Sign In
          </button>
        </form>

        <ExternalAuthSection providers={providers} />
      </AuthCard>
    </Document>
  )
}
