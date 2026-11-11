import * as dialog from '@remix-run/ui/dialog'
import { Portal } from '@remix-run/ui/portal'
import { css, on, type Handle } from 'remix/component'

export default function ExampleDialog(handle: Handle) {
  let name = 'Project notes'
  let draft = name
  let open = false

  return () => (
    <div
      mix={css({
        maxWidth: '100%',
        overflowWrap: 'anywhere',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
        color: 'light-dark(#202027, #eeeef2)',
      })}
    >
      <span>{name}</span>
      <dialog.Context
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) draft = name
          open = nextOpen
          handle.update()
        }}
      >
        <button mix={[dialog.trigger(), buttonStyle]}>Rename</button>
        <Portal>
          <div
            mix={[
              dialog.backdrop(),
              css({
                background: '#0006',
                opacity: 1,
                transition: 'opacity 140ms ease',
                '&[data-state="closed"]': {
                  opacity: 0,
                },
                '@starting-style': {
                  opacity: 0,
                },
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                },
              }),
            ]}
          />
          <section
            mix={[
              dialog.surface(),
              css({
                colorScheme: 'light dark',
                boxSizing: 'border-box',
                inset: 0,
                margin: 'auto',
                height: 'max-content',
                width: 'min(24rem, calc(100vw - 32px))',
                maxHeight: 'calc(100dvh - 32px)',
                overflow: 'auto',
                overflowWrap: 'anywhere',
                padding: '24px',
                border: '1px solid light-dark(#e0e0e6, #393940)',
                borderRadius: '12px',
                background: 'light-dark(#fff, #1b1b20)',
                color: 'light-dark(#202027, #eeeef2)',
                font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
                boxShadow: '0 16px 48px #0004',
                opacity: 1,
                transition: 'opacity 140ms ease',
                '&[data-state="closed"]': {
                  opacity: 0,
                },
                '@starting-style': {
                  opacity: 0,
                },
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                },
                '& h2': {
                  margin: 0,
                  fontSize: '20px',
                },
                '& p': {
                  margin: '8px 0 20px',
                },
                '& label': {
                  display: 'grid',
                  gap: '8px',
                },
              }),
            ]}
          >
            <h2 mix={dialog.title()}>Rename file</h2>
            <p mix={dialog.description()}>Choose a name for this file.</p>
            <form
              autocomplete="off"
              mix={on('submit', (event) => {
                event.preventDefault()
                if (!draft.trim()) return
                name = draft.trim()
                open = false
                handle.update()
              })}
            >
              <label>
                File name
                <input
                  name="name"
                  required
                  value={draft}
                  mix={[
                    dialog.focusOnShow(),
                    on('input', (event) => {
                      draft = event.currentTarget.value
                    }),
                    css({
                      boxSizing: 'border-box',
                      minWidth: 0,
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid light-dark(#d8d8df, #44444c)',
                      borderRadius: '8px',
                      background: 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                    }),
                  ]}
                />
              </label>
              <div
                mix={css({
                  display: 'flex',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginTop: '24px',
                })}
              >
                <button mix={[dialog.close(), buttonStyle]}>Cancel</button>
                <button type="submit" mix={buttonStyle}>
                  Save
                </button>
              </div>
            </form>
          </section>
        </Portal>
      </dialog.Context>
    </div>
  )
}

const buttonStyle = css({
  minHeight: '44px',
  padding: '8px 14px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #25252b)',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  '&:focus-visible': {
    outline: '2px solid light-dark(#70707c, #a0a0ac)',
    outlineOffset: '3px',
  },
})
