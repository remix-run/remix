import type { Handle, RemixNode } from 'remix/ui'

import * as styles from './styles.ts'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: RemixNode
  footer?: RemixNode
}

export function AuthCard(handle: Handle<AuthCardProps>) {
  return () => {
    let { title, subtitle, children, footer } = handle.props

    return (
      <div mix={styles.card}>
        <div mix={styles.cardHeader}>
          <h1 mix={styles.heading}>{title}</h1>
          {subtitle ? <p mix={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {children}
        {footer}
      </div>
    )
  }
}
