import { Portal } from 'remix/component'
import { css, on, type Handle } from '@remix-run/component'
import * as dialog from '@remix-run/ui/dialog'

/**
 * @name Dialog
 * @description Edit a profile with a nested discard confirmation and app-owned transitions.
 * @layout center
 */
export default function Example(handle: Handle) {
  let name = 'Alex Morgan'
  let draft = name
  let open = false

  function close() {
    open = false
    void handle.update()
  }

  return () => (
    <div mix={styles.root}>
      <p>{name}</p>
      <dialog.Context
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) draft = name
          open = nextOpen
          void handle.update()
        }}
      >
        <button mix={[dialog.trigger(), styles.button]}>Edit profile</button>
        <Portal>
          <div mix={[dialog.backdrop(), styles.backdrop]} />
        </Portal>
        <dialog.Portal>
          <dialog.SurfaceContext>
            <section mix={[dialog.surface(), styles.surface]}>
              <h2 mix={dialog.title()}>Edit profile</h2>
              <p mix={dialog.description()}>Choose the name shown on your profile.</p>
              <form
                mix={on('submit', (event) => {
                  event.preventDefault()
                  name = draft.trim()
                  close()
                })}
              >
                <label>
                  Display name
                  <input
                    name="name"
                    required
                    value={draft}
                    mix={[
                      dialog.focusOnShow(),
                      on('input', (event) => {
                        draft = event.currentTarget.value
                      }),
                    ]}
                  />
                </label>
                <div mix={styles.actions}>
                  <dialog.Context>
                    <button mix={[dialog.trigger(), styles.button]}>Discard changes</button>
                    <Portal>
                      <div mix={[dialog.backdrop(), styles.backdrop]} />
                    </Portal>
                    <dialog.Portal>
                      <dialog.SurfaceContext>
                        <section role="alertdialog" mix={[dialog.surface(), styles.surface]}>
                          <h2 mix={dialog.title()}>Discard changes?</h2>
                          <p mix={dialog.description()}>
                            Your profile will keep its saved display name.
                          </p>
                          <div mix={styles.actions}>
                            <button mix={[dialog.close(), dialog.focusOnShow(), styles.button]}>
                              Keep editing
                            </button>
                            <button type="button" mix={[on('click', close), styles.button]}>
                              Discard
                            </button>
                          </div>
                        </section>
                      </dialog.SurfaceContext>
                    </dialog.Portal>
                  </dialog.Context>
                  <button type="submit" mix={styles.button}>
                    Save
                  </button>
                </div>
              </form>
            </section>
          </dialog.SurfaceContext>
        </dialog.Portal>
      </dialog.Context>
    </div>
  )
}

const styles = {
  button: css({
    font: 'inherit',
    minHeight: 44,
    padding: '8px 14px',
    border: '1px solid light-dark(#c6c9d0, #555b66)',
    borderRadius: 8,
    color: 'inherit',
    background: 'light-dark(#fff, #282c34)',
    cursor: 'pointer',
    '&:hover': { background: 'light-dark(#f0f2f5, #363c46)' },
    '&:focus-visible': { outline: '2px solid light-dark(#245cdb, #8cb4ff)', outlineOffset: 3 },
  }),
  actions: css({
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 24,
  }),
  backdrop: css({
    position: 'fixed',
    inset: 0,
    margin: 0,
    width: 'auto',
    height: 'auto',
    border: 0,
    padding: 0,
    background: '#0006',
    opacity: 1,
    transition: 'opacity 160ms ease',
    '&[data-state="closed"]': { opacity: 0 },
    '@starting-style': { opacity: 0 },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  }),
  surface: css({
    inset: 0,
    height: 'max-content',
    fontFamily: 'system-ui, sans-serif',
    lineHeight: 1.5,
    boxSizing: 'border-box',
    width: 'min(28rem, calc(100vw - 2rem))',
    maxHeight: 'calc(100dvh - 2rem)',
    overflow: 'auto',
    overflowWrap: 'anywhere',
    margin: 'auto',
    padding: 24,
    border: '1px solid light-dark(#dadde3, #464d58)',
    borderRadius: 12,
    background: 'light-dark(#fff, #1c2027)',
    color: 'light-dark(#20242c, #f1f3f7)',
    boxShadow: '0 18px 60px #0004',
    opacity: 1,
    transform: 'translateY(0)',
    transition: 'opacity 160ms ease, transform 160ms ease',
    '&[data-state="closed"]': { opacity: 0, transform: 'translateY(8px)' },
    '@starting-style': { opacity: 0, transform: 'translateY(8px)' },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    '& h2': { fontSize: 22, lineHeight: 1.3, margin: 0 },
    '& p': { margin: '12px 0 24px' },
    '& label': { display: 'grid', gap: 8 },
    '& input': {
      boxSizing: 'border-box',
      width: '100%',
      minWidth: 0,
      font: 'inherit',
      color: 'inherit',
      background: 'transparent',
      border: '1px solid light-dark(#a7adb8, #69717f)',
      borderRadius: 6,
      padding: '10px 12px',
    },
  }),
  root: css({ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }),
}
