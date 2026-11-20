import { Document } from '../ui/document.tsx'
import * as styles from '../ui/public/styles.ts'
import { PasskeySignIn } from './public/passkey-sign-in.tsx'
import { PasskeySignUp } from './public/passkey-sign-up.tsx'

export function HomePage() {
  return () => (
    <Document title="Passkeys Demo">
      <div mix={styles.stack}>
        <section aria-labelledby="sign-in-heading" mix={styles.card}>
          <h1 id="sign-in-heading" mix={styles.heading}>
            Sign in
          </h1>
          <p mix={styles.muted}>No password needed. Your device unlocks your passkey.</p>
          <PasskeySignIn />
        </section>

        <section aria-labelledby="sign-up-heading" mix={styles.card}>
          <h2 id="sign-up-heading" mix={styles.subheading}>
            New here?
          </h2>
          <p mix={styles.muted}>
            Pick a username and your device creates a passkey for it. That passkey is the only way
            to sign in.
          </p>
          <PasskeySignUp />
        </section>

        <noscript>
          <p mix={styles.errorMessage}>Passkeys need JavaScript. Turn it on to use this demo.</p>
        </noscript>
      </div>
    </Document>
  )
}
