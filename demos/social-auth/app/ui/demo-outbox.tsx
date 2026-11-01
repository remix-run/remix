import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { OutboxEmail } from '../utils/email-outbox.ts'
import { designSystem } from './design-system.ts'
import * as styles from './styles.ts'

const { tokens } = designSystem

export function DemoOutbox(handle: Handle<{ email?: OutboxEmail }>) {
  return () => {
    let { email } = handle.props

    return (
      <section
        aria-label="Demo inbox"
        mix={[styles.infoPanel, css({ marginTop: tokens.space.lg })]}
      >
        <p mix={css({ fontWeight: tokens.typography.weight.semibold })}>Demo inbox</p>
        <p mix={css({ marginTop: tokens.space.xs })}>
          This demo does not send email. The latest sign-in email for this address appears here.
        </p>

        {email == null ? (
          <p mix={css({ marginTop: tokens.space.md })}>
            No sign-in email was sent to this address.
          </p>
        ) : (
          <div mix={css({ marginTop: tokens.space.md })}>
            <p mix={css({ fontWeight: tokens.typography.weight.medium })}>{email.subject}</p>
            <p mix={css({ marginTop: tokens.space.xs })}>{email.text}</p>
            {email.link ? (
              <p mix={css({ marginTop: tokens.space.md })}>
                <a href={email.link} mix={styles.helperLink}>
                  Open sign-in link
                </a>
              </p>
            ) : null}
            {email.code ? (
              <p
                mix={css({
                  marginTop: tokens.space.md,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: tokens.typography.size.title,
                  letterSpacing: '0.3em',
                })}
              >
                {email.code}
              </p>
            ) : null}
          </div>
        )}
      </section>
    )
  }
}
