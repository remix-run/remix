import * as fd from '@remix-run/data-schema/experimental/form'
import { Portal } from '@remix-run/ui/portal'
import { css, on, type Handle } from '@remix-run/component'
import * as accordion from '@remix-run/ui/accordion'
import * as combobox from '@remix-run/ui/combobox'
import * as dialog from '@remix-run/ui/dialog'
import * as form from '@remix-run/ui/form'
import * as listbox from '@remix-run/ui/listbox'
import * as menu from '@remix-run/ui/menu'
import * as popover from '@remix-run/ui/popover'
import { press } from '@remix-run/ui/press'
import * as select from '@remix-run/ui/select'
import * as tabs from '@remix-run/ui/tabs'
import { toggle } from '@remix-run/ui/toggle'

/**
 * @name Click vs press()
 * @description The same controls activating on click by default, and on mouse press with press().
 * @layout center
 */
export default function Example() {
  return () => (
    <div
      mix={css({
        display: 'grid',
        gap: '24px',
        width: 'min(100%, 26rem)',
        color: 'light-dark(#151515, #ececec)',
        font: '500 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
        letterSpacing: 0,
      })}
    >
      <section id="default" mix={sectionCss}>
        <h2 mix={headingCss}>Default (click)</h2>
        <p mix={noteCss}>
          Every control activates when the mouse is released. Dragging off before release cancels.
          Select and menu triggers are the exception: they open on press.
        </p>
        <Controls pressed={false} />
      </section>

      <section id="pressed" mix={sectionCss}>
        <h2 mix={headingCss}>With press()</h2>
        <p mix={noteCss}>
          The same markup with press() added: each control activates the moment the mouse is
          pressed, so a press can no longer be cancelled by dragging off.
        </p>
        <Controls pressed />
      </section>
    </div>
  )
}

function Controls(handle: Handle<{ pressed: boolean }>) {
  let counts: Record<string, number> = {}
  let selected = 'react'
  let activeValue: string | null = 'react'
  let popoverOpen = false
  let dialogOpen = false
  let confirmOpen = false
  let feedbackPressed = false

  function hit(name: string) {
    counts[name] = (counts[name] ?? 0) + 1
    void handle.update()
  }

  return () => {
    let { pressed } = handle.props

    return (
      <div mix={css({ display: 'grid', gap: '16px', justifyItems: 'start' })}>
        <p
          aria-label="Activations"
          mix={css({
            margin: 0,
            minHeight: '16px',
            color: 'light-dark(#6d6d6d, #b3b3b3)',
            font: '500 12px/16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            overflowWrap: 'anywhere',
          })}
        >
          {Object.entries(counts)
            .map(([name, count]) => `${name}:${count}`)
            .join(' ') || 'none'}
        </p>

        <div
          mix={[
            select.onSelectChange(() => hit('select')),
            css({ display: 'flex', flexWrap: 'wrap', gap: '8px' }),
          ]}
        >
          <select.Context defaultLabel="Remix" defaultValue="remix" name="framework">
            {/* Select and menu triggers open on press by default; press() isn't needed on them. */}
            <button mix={[select.trigger(), buttonCss]} type="button">
              <SelectLabel />
            </button>
            <popover.Context>
              <Portal>
                <div mix={[select.popover(), popupCss]}>
                  <div mix={[select.list(), listCss]}>
                    {frameworks.map((option) => (
                      <div
                        key={option.value}
                        mix={[select.option(option), pressed && press(), optionCss]}
                      >
                        {option.label}
                      </div>
                    ))}
                  </div>
                </div>
              </Portal>
            </popover.Context>
            <input mix={select.hiddenInput()} />
          </select.Context>

          <menu.Context label="View">
            <button mix={[menu.trigger(), buttonCss]} type="button">
              View
            </button>
            <Portal>
              <div
                mix={[
                  menu.popover(),
                  menu.onMenuSelect((event) => hit(`menu-${event.item.name}`)),
                  popupCss,
                ]}
              >
                <div mix={[menu.list(), listCss]}>
                  <div
                    mix={[
                      menu.item({ name: 'wrap', type: 'checkbox', checked: false }),
                      pressed && press(),
                      optionCss,
                    ]}
                  >
                    Word wrap
                  </div>
                  <menu.Context label="Zoom">
                    <div mix={[menu.submenuTrigger({}), pressed && press(), optionCss]}>Zoom</div>
                    <div mix={[menu.popover(), popupCss]}>
                      <div mix={[menu.list(), listCss]}>
                        <div mix={[menu.item({ name: 'zoom-in' }), pressed && press(), optionCss]}>
                          Zoom in
                        </div>
                      </div>
                    </div>
                  </menu.Context>
                </div>
              </div>
            </Portal>
          </menu.Context>
        </div>

        <div mix={combobox.onComboboxChange(() => hit('combobox'))}>
          <combobox.Context name="framework-search">
            <input
              aria-label="Framework"
              placeholder="Search frameworks"
              mix={[combobox.input(), inputCss]}
            />
            <Portal>
              <div mix={[combobox.popover(), popupCss]}>
                <div mix={[combobox.list(), listCss]}>
                  {frameworks.map((option) => (
                    <div
                      key={option.value}
                      mix={[combobox.option(option), pressed && press(), optionCss]}
                    >
                      {option.label}
                    </div>
                  ))}
                </div>
              </div>
            </Portal>
            <input mix={combobox.hiddenInput()} />
          </combobox.Context>
        </div>

        <listbox.Context
          value={selected}
          activeValue={activeValue}
          onSelect={(value) => {
            selected = value ?? 'react'
            activeValue = value
            hit('listbox')
          }}
          onHighlight={(value) => {
            activeValue = value
            void handle.update()
          }}
        >
          <div aria-label="Listbox" mix={[listbox.list(), listCss]} tabIndex={0}>
            {frameworks.map((option) => (
              <div key={option.value} mix={[listbox.option(option), pressed && press(), optionCss]}>
                {option.label}
              </div>
            ))}
          </div>
        </listbox.Context>

        <tabs.Context defaultActiveTab="overview" onActiveTabChange={() => hit('tab')}>
          <div mix={[tabs.root(), css({ display: 'grid', gap: '8px', width: '100%' })]}>
            <div aria-label="Sections" mix={[tabs.list(), css({ display: 'flex', gap: '4px' })]}>
              <button
                mix={[tabs.tab({ name: 'overview' }), pressed && press(), tabCss]}
                type="button"
              >
                Overview
              </button>
              <button
                mix={[tabs.tab({ name: 'activity' }), pressed && press(), tabCss]}
                type="button"
              >
                Activity
              </button>
            </div>
            <div mix={tabs.panel({ name: 'overview' })}>Project summary.</div>
            <div mix={tabs.panel({ name: 'activity' })}>Recent changes.</div>
          </div>
        </tabs.Context>

        <accordion.Context defaultValue="shipping" onValueChange={() => hit('accordion')}>
          <div mix={[accordion.root(), css({ display: 'grid', width: '100%' })]}>
            <accordion.ItemContext value="shipping">
              <div mix={accordion.item()}>
                <h3 mix={css({ margin: 0 })}>
                  <button mix={[accordion.trigger(), pressed && press(), buttonCss]} type="button">
                    Shipping
                  </button>
                </h3>
                <div mix={accordion.content()}>Carrier and cutoff time.</div>
              </div>
            </accordion.ItemContext>
            <accordion.ItemContext value="billing">
              <div mix={accordion.item()}>
                <h3 mix={css({ margin: 0 })}>
                  <button mix={[accordion.trigger(), pressed && press(), buttonCss]} type="button">
                    Billing
                  </button>
                </h3>
                <div mix={accordion.content()}>Invoice cadence and tax settings.</div>
              </div>
            </accordion.ItemContext>
          </div>
        </accordion.Context>

        <div mix={css({ display: 'flex', flexWrap: 'wrap', gap: '8px' })}>
          <input
            aria-label="Notifications"
            type="checkbox"
            mix={[
              toggle({ onCheckedChange: () => hit('switch') }),
              pressed && press(),
              css({ width: '32px', height: '18px', margin: 0 }),
            ]}
          />
          <button
            mix={[toggle({ onCheckedChange: () => hit('toggle') }), pressed && press(), buttonCss]}
            type="button"
          >
            Desktop alerts
          </button>
        </div>

        <form.Context schema={newsletter}>
          {({ fields }) => (
            <form
              mix={[
                form.root(),
                on('submit', (event) => {
                  event.preventDefault()
                  hit('submit')
                }),
                on('reset', () => hit('reset')),
                css({ display: 'grid', gap: '8px', justifyItems: 'start' }),
              ]}
            >
              <div mix={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                <input
                  type="checkbox"
                  mix={[
                    form.control(fields.news),
                    pressed && press(),
                    on('change', () => hit('form-label')),
                  ]}
                />
                <label mix={[form.label(fields.news), pressed && press()]}>Newsletter</label>
              </div>
              {/* A plain label activates the control it labels, so it needs press() as well. */}
              <label
                mix={[
                  css({ display: 'flex', alignItems: 'center', gap: '8px' }),
                  pressed && press(),
                ]}
              >
                <input
                  type="checkbox"
                  mix={[pressed && press(), on('change', () => hit('checkbox'))]}
                />
                Native checkbox
              </label>
              <div mix={css({ display: 'flex', gap: '12px' })}>
                <label mix={[css({ display: 'flex', gap: '4px' }), pressed && press()]}>
                  <input
                    type="radio"
                    name="size"
                    value="s"
                    mix={[pressed && press(), on('change', () => hit('radio-s'))]}
                  />
                  Small
                </label>
                <label mix={[css({ display: 'flex', gap: '4px' }), pressed && press()]}>
                  <input
                    type="radio"
                    name="size"
                    value="l"
                    mix={[pressed && press(), on('change', () => hit('radio-l'))]}
                  />
                  Large
                </label>
              </div>
              <div mix={css({ display: 'flex', gap: '8px' })}>
                <button type="submit" mix={[buttonCss, pressed && press()]}>
                  Submit
                </button>
                <button type="reset" mix={[buttonCss, pressed && press()]}>
                  Reset
                </button>
              </div>
            </form>
          )}
        </form.Context>

        <popover.Context>
          <button
            type="button"
            mix={[
              popover.anchor({ placement: 'bottom-start', offset: 8 }),
              popover.focusOnHide(),
              pressed && press(),
              buttonCss,
              on('click', () => {
                popoverOpen = !popoverOpen
                if (popoverOpen) hit('popover')
                else void handle.update()
              }),
            ]}
          >
            Popover
          </button>
          <Portal>
            <div
              mix={[
                popover.surface({
                  open: popoverOpen,
                  onHide() {
                    popoverOpen = false
                    void handle.update()
                  },
                }),
                popupCss,
              ]}
            >
              {/* popover.anchor() keeps a press from taking focus back from focusOnShow(). */}
              <button
                type="button"
                mix={[
                  popover.focusOnShow(),
                  pressed && press(),
                  buttonCss,
                  on('click', () => {
                    popoverOpen = false
                    void handle.update()
                  }),
                ]}
              >
                Close popover
              </button>
            </div>
          </Portal>
        </popover.Context>

        <dialog.Context
          open={dialogOpen}
          onOpenChange={(open) => {
            dialogOpen = open
            if (open) hit('dialog')
            else void handle.update()
          }}
        >
          <button mix={[dialog.trigger(), pressed && press(), buttonCss]} type="button">
            Dialog
          </button>
          <Portal>
            <div mix={[dialog.backdrop(), backdropCss]} />
          </Portal>
          <Portal>
            <section mix={[dialog.surface(), dialogCss]}>
              <h3 mix={[dialog.title(), css({ margin: 0 })]}>Edit profile</h3>
              <p mix={dialog.description()}>Discard your changes?</p>
              <div mix={css({ display: 'flex', gap: '8px' })}>
                <dialog.Context
                  open={confirmOpen}
                  onOpenChange={(open) => {
                    confirmOpen = open
                    if (open) hit('confirm')
                    else void handle.update()
                  }}
                >
                  <button mix={[dialog.trigger(), pressed && press(), buttonCss]} type="button">
                    Discard
                  </button>
                  <Portal>
                    <div mix={[dialog.backdrop(), backdropCss]} />
                  </Portal>
                  <Portal>
                    <section role="alertdialog" mix={[dialog.surface(), dialogCss]}>
                      <h3 mix={[dialog.title(), css({ margin: 0 })]}>Really discard?</h3>
                      <p mix={dialog.description()}>This cannot be undone.</p>
                      <button
                        mix={[dialog.close(), dialog.focusOnShow(), pressed && press(), buttonCss]}
                        type="button"
                      >
                        Keep editing
                      </button>
                    </section>
                  </Portal>
                </dialog.Context>
                <button mix={[dialog.close(), pressed && press(), buttonCss]} type="button">
                  Close dialog
                </button>
              </div>
            </section>
          </Portal>
        </dialog.Context>

        {/* Feedback only: activate: false leaves activation on the native click. */}
        <button
          type="button"
          data-pressed={feedbackPressed}
          mix={[
            press({
              activate: false,
              onPressStart() {
                feedbackPressed = true
                void handle.update()
              },
              onPressEnd() {
                feedbackPressed = false
                void handle.update()
              },
            }),
            on('click', () => hit('feedback')),
            buttonCss,
            css({ '&[data-pressed="true"]': { transform: 'scale(0.96)' } }),
          ]}
        >
          {feedbackPressed ? 'Pressed' : 'Feedback only'}
        </button>
      </div>
    )
  }
}

function SelectLabel(handle: Handle) {
  let context = handle.context.get(select.Context)
  return () => <span>{context.displayedLabel}</span>
}

const newsletter = fd.object({ news: fd.checkbox() })

const frameworks = [
  { label: 'Remix', value: 'remix' },
  { label: 'React Router', value: 'react-router' },
  { label: 'React', value: 'react' },
] as const

const sectionCss = css({
  display: 'grid',
  gap: '12px',
  border: '1px solid light-dark(#d1d1d1, #444444)',
  borderRadius: '8px',
  padding: '16px',
})

const headingCss = css({ margin: 0, font: '700 15px/20px inherit' })

const noteCss = css({
  margin: 0,
  color: 'light-dark(#6d6d6d, #b3b3b3)',
  font: '500 12px/16px inherit',
})

const buttonCss = css({
  appearance: 'none',
  minHeight: '32px',
  border: '1px solid light-dark(#d1d1d1, #444444)',
  borderRadius: '6px',
  background: 'light-dark(#ffffff, #1a1a1a)',
  color: 'inherit',
  font: 'inherit',
  padding: '0 10px',
  '&:focus-visible': {
    outline: '2px solid light-dark(#3573f6, #6eaaff)',
    outlineOffset: '2px',
  },
})

const inputCss = css({
  boxSizing: 'border-box',
  width: '100%',
  minHeight: '32px',
  border: '1px solid light-dark(#d1d1d1, #444444)',
  borderRadius: '6px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  padding: '0 10px',
})

const tabCss = css({
  appearance: 'none',
  border: 0,
  borderBlockEnd: '2px solid transparent',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  minHeight: '32px',
  padding: '0 10px',
  '&[aria-selected="true"]': { borderBlockEndColor: 'light-dark(#3573f6, #6eaaff)' },
})

const popupCss = css({
  boxSizing: 'border-box',
  margin: 0,
  border: '1px solid light-dark(#d1d1d1, #444444)',
  borderRadius: '6px',
  background: 'light-dark(#ffffff, #1a1a1a)',
  color: 'light-dark(#151515, #ececec)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  padding: '4px',
  '&[data-open]': { display: 'block' },
})

const listCss = css({ display: 'grid', gap: '2px', outline: 0 })

const optionCss = css({
  borderRadius: '4px',
  padding: '6px 8px',
  '&[data-highlighted="true"]': { background: 'light-dark(#eeeeee, #2c2c2c)' },
  '&[aria-selected="true"], &[aria-checked="true"]': {
    background: 'light-dark(#101010, #ececec)',
    color: 'light-dark(#ffffff, #151515)',
  },
})

const backdropCss = css({
  position: 'fixed',
  inset: 0,
  background: '#0006',
})

const dialogCss = css({
  boxSizing: 'border-box',
  inset: 0,
  height: 'max-content',
  width: 'min(24rem, calc(100vw - 2rem))',
  margin: 'auto',
  padding: '20px',
  border: '1px solid light-dark(#dadde3, #464d58)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1c2027)',
  color: 'light-dark(#20242c, #f1f3f7)',
  '& p': { margin: '12px 0 20px' },
})
