import type { RemixNode } from 'remix/component'

import { AuthCard, Document, Notice } from '../shared/index.ts'
import * as styles from '../styles.ts'

export interface ErrorPageProps {
  title: string
  message: RemixNode
  loginHref: string
}

export function ErrorPage() {
  return ({ title, message, loginHref }: ErrorPageProps) => (
    <Document title={title}>
      <AuthCard title={title} subtitle="This request could not be completed.">
        <Notice tone="error">{message}</Notice>
        <a href={loginHref} mix={styles.secondaryButton}>
          Back to Sign In
        </a>
      </AuthCard>
    </Document>
  )
}
