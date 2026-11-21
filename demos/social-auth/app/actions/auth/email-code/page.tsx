import type { Handle } from 'remix/component'

import { AuthCard } from '../../../ui/auth-card.tsx'
import { Document } from '../../../ui/document.tsx'
import { TextField } from '../../../ui/form-field.tsx'
import { EmailIcon } from '../../../ui/icons.tsx'
import { Notice } from '../../../ui/notice.tsx'
import * as styles from '../../../ui/styles.ts'
import { Footer } from '../footer.tsx'

interface EmailCodePageProps {
  formAction: string
  loginHref: string
  error?: string
  email?: string
}

export function EmailCodePage(handle: Handle<EmailCodePageProps>) {
  return () => {
    let { formAction, loginHref, error, email } = handle.props

    return (
      <Document title="Sign In With a Code">
        <AuthCard
          title="Sign In With a Code"
          subtitle="We will email you a one-time code to enter on this device"
          footer={<Footer prefix="Have a password?" href={loginHref} label="Back to sign in" />}
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
              Email Me a Code
            </button>
          </form>
        </AuthCard>
      </Document>
    )
  }
}
