import { ui } from 'remix/theme'
import { statusBadgeCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={[ui.stack, ui.gap.xs]}>
      <button type="button" mix={ui.item.base}>
        <span>Members</span>
        <span mix={[statusBadgeCss, ui.status.success]}>12 online</span>
      </button>
      <button type="button" mix={ui.item.danger}>
        <span>Archive workspace</span>
        <span mix={ui.text.caption}>Permanent</span>
      </button>
    </div>
  )
}
