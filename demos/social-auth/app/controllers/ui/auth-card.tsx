import type { RemixNode } from 'remix/component'

import * as styles from './styles.ts'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: RemixNode
  footer?: RemixNode
}

export function AuthCard() {
  return ({ title, subtitle, children, footer }: AuthCardProps) => (
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
