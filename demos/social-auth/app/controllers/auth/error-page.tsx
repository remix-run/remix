import type { RemixNode } from 'remix/ui'

import { AuthCard } from '../../ui/auth-card.tsx'
import { Document } from '../../ui/document.tsx'
import { Notice } from '../../ui/notice.tsx'
import * as styles from '../../ui/styles.ts'

interface ErrorPageProps {
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
