import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { AuthCard } from '../../../ui/auth-card.tsx'
import { designSystem } from '../../../ui/design-system.ts'
import { Document } from '../../../ui/document.tsx'
import * as styles from '../../../ui/styles.ts'
import { Footer } from '../footer.tsx'

const { tokens } = designSystem

export function MagicLinkConfirmPage(handle: Handle<{ loginHref: string }>) {
  return () => (
    <Document title="Finish Signing In">
      <AuthCard
        title="Finish Signing In"
        subtitle="Confirm that you want to sign in on this device"
        footer={
          <Footer prefix="Did not request this?" href={handle.props.loginHref} label="Go home" />
        }
      >
        <div mix={styles.infoPanel}>
          <p>
            Sign-in links wait for this confirmation so email security scanners that open links
            cannot use them up.
          </p>
        </div>

        {/* Without an action, the form posts back to this URL, including the link token. */}
        <form method="POST" mix={css({ marginTop: tokens.space.lg })}>
          <button type="submit" mix={styles.submitButton}>
            Sign In
          </button>
        </form>
      </AuthCard>
    </Document>
  )
}
