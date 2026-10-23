import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { designSystem } from './design-system.ts'
import * as styles from './styles.ts'

const { theme } = designSystem

export function Divider(handle: Handle<{ label: string }>) {
  return () => (
    <div mix={styles.divider}>
      <div mix={css({ flex: '1', borderTop: theme.border.subtle })}></div>
      <span mix={styles.dividerText}>{handle.props.label}</span>
      <div mix={css({ flex: '1', borderTop: theme.border.subtle })}></div>
    </div>
  )
}
