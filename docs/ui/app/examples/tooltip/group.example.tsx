import * as tooltip from '@remix-run/ui/tooltip'
import { css } from 'remix/component'

const actions = [
  {
    label: 'Bold',
    keys: 'Meta+B',
    shortcut: '⌘B',
    icon: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  },
  { label: 'Italic', keys: 'Meta+I', shortcut: '⌘I', icon: 'M10 5h8M6 19h8M14 5l-4 14' },
  { label: 'Underline', keys: 'Meta+U', shortcut: '⌘U', icon: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14' },
  {
    label: 'Strikethrough',
    keys: 'Meta+Shift+X',
    shortcut: '⌘⇧X',
    icon: 'M4 12h16M16 6.5A4 4 0 0 0 12 5c-2.5 0-4 1.3-4 3M8 17.5A4.5 4.5 0 0 0 12 19c2.5 0 4-1.5 4-3.5',
  },
]

export default function ExampleTooltipGroup() {
  return () => (
    <div
      mix={css({
        colorScheme: 'light dark',
        display: 'flex',
        justifyContent: 'center',
        padding: '48px 0 8px',
        color: 'light-dark(#202027, #eeeef2)',
        font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
      })}
    >
      <tooltip.GroupContext delay={500}>
        <div
          role="toolbar"
          aria-label="Text formatting"
          mix={css({
            display: 'flex',
            gap: '2px',
            padding: '4px',
            border: '1px solid light-dark(#d8d8df, #44444c)',
            borderRadius: '10px',
            background: 'light-dark(#fff, #25252b)',
          })}
        >
          {actions.map((action) => (
            <tooltip.Context key={action.label}>
              <button
                type="button"
                aria-label={action.label}
                aria-keyshortcuts={action.keys}
                mix={[
                  tooltip.trigger(),
                  css({
                    display: 'inline-flex',
                    padding: '8px',
                    border: 0,
                    borderRadius: '6px',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    '&:hover, &[data-state="open"]': {
                      background: 'light-dark(#f0f0f5, #303038)',
                    },
                    '&:focus-visible': {
                      outline: '2px solid light-dark(#70707c, #a0a0ac)',
                      outlineOffset: '1px',
                    },
                  }),
                ]}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d={action.icon} />
                </svg>
              </button>
              <div
                mix={[
                  tooltip.popup({ placement: 'bottom', offset: 8 }),
                  css({
                    display: 'none',
                    gap: '8px',
                    alignItems: 'center',
                    margin: 0,
                    padding: '4px 8px',
                    border: 0,
                    borderRadius: '6px',
                    background: 'light-dark(#202027, #eeeef2)',
                    color: 'light-dark(#fff, #18181c)',
                    font: '500 12px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
                    opacity: 0,
                    translate: '0 -2px',
                    transition:
                      'opacity 120ms ease, translate 120ms ease, display 120ms allow-discrete, overlay 120ms allow-discrete',
                    '&:popover-open': {
                      display: 'flex',
                      opacity: 1,
                      translate: '0 0',
                      '@starting-style': { opacity: 0, translate: '0 -2px' },
                    },
                    // Moving between triggers in a warm group swaps tooltips without fading.
                    '&[data-instant]': { transition: 'none' },
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }),
                ]}
              >
                {action.label}
                <kbd mix={css({ font: 'inherit', opacity: 0.6 })}>{action.shortcut}</kbd>
              </div>
            </tooltip.Context>
          ))}
        </div>
      </tooltip.GroupContext>
    </div>
  )
}
