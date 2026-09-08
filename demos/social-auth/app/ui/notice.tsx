import type { Handle, RemixNode } from 'remix/ui'

import * as styles from './styles.ts'

interface NoticeProps {
  tone: 'error' | 'success'
  children: RemixNode
}

export function Notice(handle: Handle<NoticeProps>) {
  return () => {
    let { tone, children } = handle.props

    return (
      <div mix={[styles.notice, tone === 'error' ? styles.errorNotice : styles.successNotice]}>
        {children}
      </div>
    )
  }
}
