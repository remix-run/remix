import type { Handle } from 'remix/component'

import { AuthCard } from '../../../ui/auth-card.tsx'
import { DemoOutbox } from '../../../ui/demo-outbox.tsx'
import { Document } from '../../../ui/document.tsx'
import { TextField } from '../../../ui/form-field.tsx'
import { EmailIcon } from '../../../ui/icons.tsx'
import { Notice } from '../../../ui/notice.tsx'
import * as styles from '../../../ui/styles.ts'
import type { OutboxEmail } from '../../../utils/email-outbox.ts'
import { Footer } from '../footer.tsx'

interface MagicLinkPageProps {
  formAction: string
  loginHref: string
  error?: string
  email?: string
}

export function MagicLinkPage(handle: Handle<MagicLinkPageProps>) {
  return () => {
    let { formAction, loginHref, error, email } = handle.props

    return (
      <Document title="Sign In With Email">
        <AuthCard
          title="Sign In With Email"
          subtitle="We will email you a single-use sign-in link"
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
              Email Me a Link
            </button>
          </form>
        </AuthCard>
      </Document>
    )
  }
}

interface MagicLinkSentPageProps {
  email: string
  loginHref: string
  notice?: string
  outboxEmail?: OutboxEmail
}

export function MagicLinkSentPage(handle: Handle<MagicLinkSentPageProps>) {
  return () => {
    let { email, loginHref, notice, outboxEmail } = handle.props

    return (
      <Document title="Check Your Email">
        <AuthCard
          title="Check Your Email"
          subtitle={`We sent a sign-in link to ${email}. It works once and expires in 15 minutes.`}
          footer={<Footer prefix="Wrong address?" href={loginHref} label="Back to sign in" />}
        >
          {notice ? <Notice tone="error">{notice}</Notice> : null}
          <DemoOutbox email={outboxEmail} />
        </AuthCard>
      </Document>
    )
  }
}
