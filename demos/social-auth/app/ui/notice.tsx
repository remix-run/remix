import type { RemixNode } from 'remix/ui'

import * as styles from './styles.ts'

interface NoticeProps {
  tone: 'error' | 'success'
  children: RemixNode
}

export function Notice() {
  return ({ tone, children }: NoticeProps) => (
    <div mix={[styles.notice, tone === 'error' ? styles.errorNotice : styles.successNotice]}>
      {children}
    </div>
  )
}
