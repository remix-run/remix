import * as combobox from '@remix-run/ui/combobox'
import * as dialog from '@remix-run/ui/dialog'
import * as menu from '@remix-run/ui/menu'
import * as popover from '@remix-run/ui/popover'
import { Portal } from '@remix-run/ui/portal'
import * as select from '@remix-run/ui/select'
import * as toast from '@remix-run/ui/toast'
import { animateEntrance, animateExit, prefersReducedMotion } from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

const toastManager = toast.createToastManager()

export default function ExampleDialogToast(handle: Handle) {
  return () => (
    <div mix={styles.theme}>
      <dialog.Context>
        <button mix={[dialog.trigger(), styles.button]}>Open dialog</button>
        <dialog.Portal>
          <div mix={[dialog.backdrop(), styles.backdrop]} />
          <dialog.SurfaceContext>
            <section mix={[dialog.surface(), styles.surface]}>
              <h2 mix={dialog.title()}>Dialog with other patterns</h2>
              <p mix={[dialog.description(), styles.description]}>
                Open different patterns inside the dialog to try their stacking, focus and dismissal
                together.
              </p>
              <div mix={styles.patterns}>
                <ExampleSelect label="Select" />
                <combobox.Context>
                  <div mix={styles.field}>
                    <label for={`${handle.id}-combobox`}>Combobox</label>
                    <input
                      id={`${handle.id}-combobox`}
                      placeholder="Search options"
                      mix={[combobox.input(), styles.button, styles.input]}
                    />
                  </div>
                  <combobox.Portal>
                    <combobox.PopoverContext>
                      <div mix={[combobox.popover(), styles.theme, styles.popover]}>
                        <div aria-label="Combobox options" mix={[combobox.list(), styles.list]}>
                          {options.map((option) => (
                            <div key={option.value} mix={[combobox.option(option), styles.option]}>
                              {option.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </combobox.PopoverContext>
                  </combobox.Portal>
                </combobox.Context>
                <div mix={styles.actions}>
                  <menu.Context label="Menu">
                    <button mix={[menu.trigger({ offset: 8 }), styles.button]}>Menu</button>
                    <menu.Portal>
                      <menu.PopoverContext>
                        <div mix={[menu.popover(), styles.theme, styles.popover]}>
                          <div mix={[menu.list(), styles.list]}>
                            <div mix={[menu.item({ name: 'action-a' }), styles.menuItem]}>
                              Action A
                            </div>
                            <menu.Context label="Submenu">
                              <div
                                mix={[menu.submenuTrigger({ label: 'Submenu' }), styles.menuItem]}
                              >
                                Submenu <span aria-hidden="true">›</span>
                              </div>
                              <menu.Portal>
                                <menu.PopoverContext>
                                  <div mix={[menu.popover(), styles.theme, styles.popover]}>
                                    <div mix={[menu.list(), styles.list]}>
                                      <div mix={[menu.item({ name: 'action-b' }), styles.menuItem]}>
                                        Action B
                                      </div>
                                      <div mix={[menu.item({ name: 'action-c' }), styles.menuItem]}>
                                        Action C
                                      </div>
                                    </div>
                                  </div>
                                </menu.PopoverContext>
                              </menu.Portal>
                            </menu.Context>
                          </div>
                        </div>
                      </menu.PopoverContext>
                    </menu.Portal>
                  </menu.Context>
                  <ExamplePopover />
                  <dialog.Context>
                    <button mix={[dialog.trigger(), styles.button]}>Nested dialog</button>
                    <dialog.Portal>
                      <div mix={[dialog.backdrop(), styles.backdrop]} />
                      <dialog.SurfaceContext>
                        <section mix={[dialog.surface(), styles.surface]}>
                          <h2 mix={dialog.title()}>Nested dialog</h2>
                          <button mix={[dialog.close(), styles.button]}>Close</button>
                        </section>
                      </dialog.SurfaceContext>
                    </dialog.Portal>
                  </dialog.Context>
                  <button
                    type="button"
                    mix={[
                      on('click', () => {
                        toastManager.add({ id: 'action', title: 'Action completed' })
                      }),
                      styles.button,
                    ]}
                  >
                    Toast
                  </button>
                </div>
              </div>
              <div mix={styles.actions}>
                <button mix={[dialog.close(), styles.button]}>Close</button>
              </div>
            </section>
          </dialog.SurfaceContext>
        </dialog.Portal>
      </dialog.Context>
      <Portal>
        <ToastRegion />
      </Portal>
    </div>
  )
}

function ExampleSelect(handle: Handle<{ label: string; focusOnShow?: boolean }>) {
  return () => (
    <div mix={styles.field}>
      <span id={`${handle.id}-label`}>{handle.props.label}</span>
      <select.Context defaultLabel="Option A" defaultValue="a">
        <button
          aria-labelledby={`${handle.id}-label`}
          mix={[
            select.trigger(),
            handle.props.focusOnShow ? popover.focusOnShow() : undefined,
            styles.button,
            styles.selectTrigger,
          ]}
        >
          <SelectedLabel />
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>

        <select.Portal>
          <select.PopoverContext>
            <div mix={[select.popover(), styles.theme, styles.popover]}>
              <div aria-label={handle.props.label} mix={[select.list(), styles.list]}>
                {options.map((option) => (
                  <div key={option.value} mix={[select.option(option), styles.option]}>
                    {option.label}
                  </div>
                ))}
              </div>
            </div>
          </select.PopoverContext>
        </select.Portal>
      </select.Context>
    </div>
  )
}

function ExamplePopover(handle: Handle) {
  let open = false
  return () => (
    <popover.Context>
      <button
        aria-controls={`${handle.id}-popover`}
        aria-expanded={open}
        mix={[
          popover.anchor({ placement: 'bottom', offset: 8 }),
          popover.focusOnHide(),
          on('click', () => {
            open = !open
            handle.update()
          }),
          styles.button,
        ]}
      >
        Popover
      </button>
      <popover.Portal>
        <popover.SurfaceContext>
          <section
            id={`${handle.id}-popover`}
            role="dialog"
            aria-label="Popover"
            mix={[
              popover.surface({
                open,
                onHide() {
                  open = false
                  handle.update()
                },
              }),
              styles.theme,
              styles.popover,
              styles.popoverContent,
            ]}
          >
            <ExampleSelect label="Nested Select" focusOnShow />
          </section>
        </popover.SurfaceContext>
      </popover.Portal>
    </popover.Context>
  )
}

const options = [
  { label: 'Option A', value: 'a' },
  { label: 'Option B', value: 'b' },
  { label: 'Option C', value: 'c' },
]

function SelectedLabel(handle: Handle) {
  let context = handle.context.get(select.Context)
  return () => <span>{context.displayedLabel}</span>
}

function ToastRegion() {
  return () => (
    <toast.Context manager={toastManager} limit={1}>
      {(toastItems) => {
        let reducedMotion = prefersReducedMotion()
        return (
          <section mix={[toast.root({ label: 'Notifications' }), styles.viewport]}>
            {toastItems.map((toastItem) => (
              <toast.ItemContext key={toastItem.id} value={toastItem.id}>
                <article
                  key={toastItem.id}
                  style={{
                    animationName:
                      toastItem.revision === 0 || reducedMotion
                        ? 'none'
                        : toastItem.revision % 2 === 0
                          ? 'toast-pulse-even'
                          : 'toast-pulse-odd',
                  }}
                  mix={[
                    toast.item(),
                    animateEntrance({
                      translate: '0 calc(100% + max(16px, env(safe-area-inset-bottom)))',
                      duration: reducedMotion ? 0 : 160,
                      easing: 'ease-out',
                    }),
                    animateExit({
                      opacity: 0,
                      translate: 'calc(100% + 24px) 0',
                      duration: reducedMotion ? 0 : 140,
                      easing: 'ease-out',
                    }),
                    styles.toast,
                  ]}
                >
                  <h2 mix={[toast.title(), styles.toastTitle]}>{toastItem.title}</h2>
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    mix={[toast.close(), styles.dismissButton]}
                  >
                    ×
                  </button>
                </article>
              </toast.ItemContext>
            ))}
          </section>
        )
      }}
    </toast.Context>
  )
}

const styles = {
  theme: css({
    colorScheme: 'light dark',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 ui-sans-serif, system-ui, sans-serif',
  }),
  button: css({
    minHeight: '40px',
    padding: '8px 14px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '8px',
    background: 'light-dark(#fff, #25252b)',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    '&:focus': { outline: '2px solid currentColor', outlineOffset: '3px' },
  }),
  popover: css({
    boxSizing: 'border-box',
    margin: 0,
    padding: '6px',
    minWidth: '160px',
    maxWidth: 'calc(100vw - 32px)',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '8px',
    background: 'light-dark(#fff, #1b1b20)',
    boxShadow: '0 8px 24px #0003',
    opacity: 0,
    transition: 'opacity 140ms ease',
    '&[data-state="open"]': {
      opacity: 1,
      '@starting-style': { opacity: 0 },
    },
    '&[data-close-animation="none"], &[data-show-reason="hint"]': { transition: 'none' },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  }),
  list: css({ display: 'grid', gap: '2px', maxHeight: '240px', overflow: 'auto', outline: 0 }),
  option: css({
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'default',
    '&[hidden]': { display: 'none' },
    '&[data-highlighted="true"]': { background: 'light-dark(#eeeef3, #303038)' },
    '&[aria-selected="true"]': { fontWeight: 600 },
    '&[data-select-flash], &[data-combobox-flash]': { background: 'light-dark(#d6d6e0, #4b4b56)' },
  }),
  menuItem: css({
    display: 'flex',
    justifyContent: 'space-between',
    gap: '24px',
    padding: '8px 12px',
    borderRadius: '4px',
    outline: 0,
    cursor: 'default',
    '&[data-highlighted]': { background: 'light-dark(#eeeef3, #303038)' },
    '&[data-menu-flash]': { background: 'light-dark(#d6d6e0, #4b4b56)' },
  }),
  backdrop: css({ background: '#0006' }),
  surface: css({
    colorScheme: 'light dark',
    boxSizing: 'border-box',
    inset: 0,
    margin: 'auto',
    width: 'min(28rem, calc(100vw - 32px))',
    height: 'max-content',
    maxHeight: 'calc(100dvh - 32px)',
    overflow: 'auto',
    padding: '24px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #1b1b20)',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 ui-sans-serif, system-ui, sans-serif',
    boxShadow: '0 16px 48px #0004',
    '& h2': { margin: '0 0 20px', fontSize: '20px' },
  }),
  actions: css({ display: 'flex', flexWrap: 'wrap', gap: '12px' }),
  viewport: css({
    position: 'fixed',
    insetInlineEnd: '16px',
    bottom: 'max(16px, env(safe-area-inset-bottom))',
    width: 'min(380px, calc(100vw - 32px))',
    zIndex: 'calc(var(--rmx-layer-base, 0) + 1000)',
    colorScheme: 'light dark',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.5 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    '&, & *': { boxSizing: 'border-box' },
    '&:focus': { outline: '2px solid currentColor', outlineOffset: '3px' },
  }),
  toast: css({
    transformOrigin: 'bottom center',
    animationDuration: '240ms',
    animationTimingFunction: 'ease-out',
    '@keyframes toast-pulse-even': {
      '0%, 100%': { scale: 1 },
      '50%': { scale: 1.03 },
    },
    '@keyframes toast-pulse-odd': {
      '0%, 100%': { scale: 1 },
      '50%': { scale: 1.03 },
    },
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0s' },
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '17px',
    border: '1px solid light-dark(#dedee5, #41414a)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #222228)',
    boxShadow: '0 8px 28px #00000012, 0 2px 6px #00000008',
    '&[data-limited]': { display: 'none' },
    '&:focus': { outline: '2px solid currentColor', outlineOffset: '3px' },
  }),
  toastTitle: css({ flex: 1, minWidth: 0, margin: 0, fontSize: '13px' }),
  dismissButton: css({
    appearance: 'none',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    width: '28px',
    height: '28px',
    margin: '0 -5px 0 0',
    border: 0,
    borderRadius: '5px',
    background: 'none',
    color: 'light-dark(#777780, #a2a2ad)',
    font: '20px/1 ui-sans-serif, system-ui, sans-serif',
    cursor: 'pointer',
    '&:hover': { background: 'light-dark(#f0f0f5, #34343d)' },
    '&:focus': { outline: '2px solid currentColor', outlineOffset: '2px' },
  }),

  description: css({ margin: '0 0 24px' }),
  patterns: css({ display: 'grid', gap: '24px', marginBottom: '24px' }),
  field: css({ display: 'grid', gap: '10px' }),
  input: css({ width: '100%', boxSizing: 'border-box' }),
  selectTrigger: css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }),
  popoverContent: css({ padding: '16px', width: '240px' }),
}
