import { on, ref, type Handle } from 'remix/component'
import { Glyph, listbox, ui } from 'remix/ui'

import { popover } from '../../../../src/lib/popover/popover.ts'

export default function Example(handle: Handle) {
  let popoverRef: HTMLElement

  return () => (
    <popover.context>
      <button mix={[popover.button({ placement: 'bottom-start' }), ui.popover.button]}>
        <span mix={ui.button.label}>Filter by type</span>
        <Glyph mix={ui.button.icon} name="chevronDown" />
      </button>

      <listbox.context>
        <div
          aria-label="Issue type"
          mix={[
            popover.surface(),
            listbox.list(),
            popover.initialFocus(),
            ui.popover.surface,
            ui.listbox.surface,
            ref((node) => {
              popoverRef = node
            }),
            on(listbox.change, () => {
              popoverRef.hidePopover()
            }),
          ]}
        >
          {issueTypeOptions.map((option) => (
            <div key={option.value} mix={[ui.listbox.option, listbox.option(option)]}>
              <Glyph mix={ui.listbox.glyph} name="check" />
              <span mix={ui.listbox.label}>{option.label}</span>
            </div>
          ))}
        </div>
      </listbox.context>
    </popover.context>
  )
}

let issueTypeOptions = [
  { label: 'All issues', value: 'all' },
  { label: 'Bug', value: 'bug' },
  { label: 'Feature', value: 'feature' },
  { label: 'Docs', value: 'docs' },
  { disabled: true, label: 'Archived', value: 'archived' },
] as const
