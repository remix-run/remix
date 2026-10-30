import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { AuthCard } from '../../../ui/auth-card.tsx'
import { DemoOutbox } from '../../../ui/demo-outbox.tsx'
import { designSystem } from '../../../ui/design-system.ts'
import { Document } from '../../../ui/document.tsx'
import { TextField } from '../../../ui/form-field.tsx'
import { PasswordIcon } from '../../../ui/icons.tsx'
import { Notice } from '../../../ui/notice.tsx'
import * as styles from '../../../ui/styles.ts'
import type { OutboxEmail } from '../../../utils/email-outbox.ts'
import { Footer } from '../footer.tsx'

const { tokens } = designSystem

interface EmailCodeVerifyPageProps {
  email: string
  formAction: string
  resendAction: string
  loginHref: string
  error?: string
  outboxEmail?: OutboxEmail
}

export function EmailCodeVerifyPage(handle: Handle<EmailCodeVerifyPageProps>) {
  return () => {
    let { email, formAction, resendAction, loginHref, error, outboxEmail } = handle.props

    return (
      <Document title="Enter Your Code">
        <AuthCard
          title="Enter Your Code"
          subtitle={`We sent a 6-digit code to ${email}. It expires in 10 minutes.`}
          footer={<Footer prefix="Wrong address?" href={loginHref} label="Back to sign in" />}
        >
          {error ? <Notice tone="error">{error}</Notice> : null}

          <form method="POST" action={formAction} mix={styles.form}>
            <TextField
              id="code"
              name="code"
              type="text"
              label="Code"
              placeholder="123456"
              autoComplete="one-time-code"
              required
              icon={<PasswordIcon mix={styles.fieldIcon} />}
            />

            <button type="submit" mix={styles.submitButton}>
              Sign In
            </button>
          </form>

          <form method="POST" action={resendAction} mix={css({ marginTop: tokens.space.md })}>
            <input type="hidden" name="email" value={email} />
            <button type="submit" mix={styles.secondaryButton}>
              Send a New Code
            </button>
          </form>

          <DemoOutbox email={outboxEmail} />
        </AuthCard>
      </Document>
    )
  }
}
