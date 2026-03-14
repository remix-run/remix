import { ui } from 'remix/ui'

export default function Example() {
  return () => (
    <div mix={[ui.stack, ui.gap.md]}>
      <div mix={[ui.row, ui.row.between, ui.gap.sm]}>
        <span mix={ui.text.label}>Toolbar</span>
        <button mix={ui.button.secondary}>Filter</button>
      </div>
      <div mix={[ui.row, ui.row.wrap, ui.gap.sm]}>
        <button mix={ui.button.primary}>Save</button>
        <button mix={ui.button.secondary}>Share</button>
        <button mix={ui.button.danger}>Delete</button>
      </div>
    </div>
  )
}
