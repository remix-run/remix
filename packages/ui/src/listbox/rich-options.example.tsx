import { css } from 'remix/component'
import type { Handle } from 'remix/component'
import * as listbox from '@remix-run/ui/listbox'

export default function Example(handle: Handle) {
  let value: string | null = 'design'
  let activeValue: string | null = null
  let activeId: string | undefined
  return () => (
    <div mix={stackCss}>
      <div mix={cardCss}>
        <strong>Assign to team</strong>
        <listbox.Context
          value={value}
          activeValue={activeValue}
          onSelect={(next) => {
            value = next
            handle.update()
          }}
          onHighlight={(next, option) => {
            activeValue = next
            activeId = option?.id
            handle.update()
          }}
        >
          <div
            tabIndex={0}
            aria-label="Team"
            aria-activedescendant={activeId}
            mix={[listCss, listbox.list()]}
          >
            {options.map((option) => (
              <div key={option.value} mix={[optionCss, listbox.option(option)]}>
                <span>
                  <strong>{option.label}</strong>
                  <p mix={mutedCss}>{option.detail}</p>
                </span>
                <span aria-hidden="true" mix={iconSlotCss}>
                  {value === option.value && <CheckIcon />}
                </span>
              </div>
            ))}
          </div>
        </listbox.Context>
      </div>
    </div>
  )
}
const options = [
  {
    value: 'design',
    label: 'Design',
    detail: 'Brand and product',
    textValue: ['design', 'creative'],
  },
  {
    value: 'engineering',
    label: 'Engineering',
    detail: 'Platform and infrastructure',
    textValue: ['engineering', 'development'],
  },
  { value: 'marketing', label: 'Marketing', detail: 'Invitations paused', disabled: true },
]

const stackCss = css({
  colorScheme: 'light dark',
  width: '320px',
  maxWidth: '100%',
  display: 'grid',
  gap: '16px',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})

const cardCss = css({
  padding: '20px',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1b1b20)',
  display: 'grid',
  gap: '16px',
})

const mutedCss = css({ margin: 0, fontSize: '12px', color: 'light-dark(#62626c, #b0b0bb)' })

const listCss = css({
  display: 'grid',
  gap: '2px',
  maxHeight: '240px',
  overflow: 'auto',
  outline: 0,
})

const optionCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '10px 12px',
  borderRadius: '6px',
  cursor: 'default',
  '&[hidden]': { display: 'none' },
  '&[data-highlighted="true"]': { background: 'light-dark(#eeeef3, #303038)' },
  '&[aria-selected="true"]': {
    color: 'light-dark(#0578be, #80caff)',
    background: 'light-dark(#eaf5fc, #173348)',
  },
  '&[aria-disabled="true"]': { opacity: 0.4 },
  '&[data-listbox-flash]': {
    background: 'light-dark(#0578be, #80caff)',
    color: 'light-dark(#fff, #102332)',
  },
})

const iconSlotCss = css({ width: '16px', display: 'inline-flex' })

function CheckIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path
        d="m5 12 4 4L19 6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}
