import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Press',
  slug: 'press',
  category: 'patterns',
  description: 'Opt controls into activating on mouse press, and follow the press lifecycle.',
  importPath: '@remix-run/ui/press',
} satisfies PageMeta

const basic = await loadExample('press/basic')
const hold = await loadExample('press/hold')

const anatomyCode = await highlightSource(`
  import { press } from '@remix-run/ui/press'

  <button type="submit" mix={press()}>Save</button>
  <label mix={press()}><input type="checkbox" /> Subscribe</label>
`)

const clickCode = await highlightSource(`
  <button
    type="button"
    aria-pressed={bold}
    mix={[
      press(),
      on('click', () => {
        bold = !bold
        handle.update()
      }),
    ]}
  >
    Bold
  </button>
`)

const compositionCode = await highlightSource(`
  <button mix={[tabs.tab({ name: 'account' }), press()]}>Account</button>
  <input type="checkbox" mix={[toggle(), press()]} />
  <div mix={[select.option({ label: 'Remix', value: 'remix' }), press()]}>Remix</div>
  <div mix={[menu.item({ name: 'rename' }), press()]}>Rename</div>
  <button mix={[dialog.trigger(), press()]}>Edit</button>
  <label mix={[form.label(field), press()]}>Name</label>
`)

const feedbackCode = await highlightSource(`
  <button
    mix={press({
      activate: false,
      onPressStart() {
        pressed = true
        handle.update()
      },
      onPressEnd() {
        pressed = false
        handle.update()
      },
    })}
  />
`)

const lifecycleCode = await highlightSource(`
  <div
    tabIndex={0}
    mix={press({
      onPressStart({ clientX, clientY }) {
        pressed = true
        handle.update()
      },
      onPressEnd({ cancelled }) {
        pressed = false
        handle.update()
      },
    })}
  />
`)

const pressType = await highlightSource(`
  export const press: MixinFactory<HTMLElement, [options?: PressOptions], ElementProps>

  type PressInfo = {
    clientX: number
    clientY: number
    pointerType: string
  }

  type PressOptions = {
    onPressStart?(press: PressInfo): void
    onPressEnd?(press: PressInfo & { cancelled: boolean }): void
    onLongPress?(press: PressInfo): void
    longPressDuration?: number
    activate?: boolean
  }
`)

export default function PressPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <p>
          Every Remix UI control activates on the native <code>click</code>, on release, so a press
          can be cancelled by dragging off. Add <code>press()</code> to a host to activate it on a
          primary mouse button press instead. The press dispatches a click on the host, carrying the
          press’s position and button, and cancels the click that follows the release. Checkbox and
          radio state, <code>input</code> and <code>change</code> events, label forwarding, form
          submission and reset, links, and your own <code>click</code> listeners all behave natively
          and run once.
        </p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="when" title="When to use it">
        <p>
          Early activation can’t be cancelled by dragging off before release, which{' '}
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html">
            WCAG 2.5.2 Pointer Cancellation
          </a>{' '}
          (Level A) asks for. Use <code>press()</code> only where acting on press is essential or
          easily reversible, and keep destructive actions on the click.
        </p>
        <p>
          The click that <code>press()</code> dispatches is untrusted (<code>isTrusted</code> is{' '}
          <code>false</code>), so analytics that ignore untrusted clicks won’t see it. The real
          click that follows the release never reaches the host or its descendants, but listeners on
          ancestors, <code>document</code>, or <code>window</code> that capture still see that
          trailing, trusted click, so a capture listener on <code>window</code> sees the activation
          twice.
        </p>
      </Section>
      <Section id="composition" title="Composing with Remix UI">
        <p>
          Put <code>press()</code> next to the primitive’s mixin on the element that should activate
          on press. It works with tabs, toggle, select, menu and combobox options and items, dialog
          triggers and close buttons, popover anchors, and <code>form.label()</code> labels. Dialog
          triggers, close buttons, and popover anchors with a <code>focusOnShow()</code> target keep
          the press from taking focus back from the overlay.
        </p>
        <CodeBlock html={compositionCode} />
        <p>
          Keep the <code>click</code> listener when you add <code>press()</code> to your own
          controls.
        </p>
        <CodeBlock html={clickCode} />
        <p>
          Select and menu triggers open on mouse press by default, like native menus, without{' '}
          <code>press()</code>. Pressing, dragging at least 10px, and releasing over an option or
          item commits it in one gesture, and the popup opens directly, without a click. In an open
          list an item commits on release, and pressing one item and releasing over another commits
          the item under the release.
        </p>
      </Section>
      <Section id="input" title="Input types">
        <p>
          Touch and pen keep the native click so scrolling still works. Keyboard and assistive
          technology clicks are untouched. Secondary buttons, modifier presses and disabled hosts
          are left to the browser. Style the pressed state with <code>:active</code>, or follow it
          with the lifecycle callbacks below to include keyboard presses.
        </p>
        <p>
          The host structurally gets <code>cursor: default</code> and <code>user-select: none</code>{' '}
          in the <code>rmx</code> layer, so double-clicking a pressed label or button doesn’t select
          its text. Text-entry controls, on the host or inside it such as the input of a wrapping
          label, keep their native text cursor and selection. App styles can override it.
        </p>
        <p>
          On a <code>&lt;label&gt;</code>, wrapping or <code>for=</code>, a press does what a native
          label click does: checkboxes and radios toggle once and text inputs take focus. A plain
          label that wraps or points at a <code>press()</code> control (such as a{' '}
          <code>toggle()</code> input) activates it on press too, without any markup change.
        </p>
      </Section>
      <Section id="lifecycle" title="Press lifecycle">
        <p>
          Pass callbacks to follow a press without changing what it activates, except that{' '}
          <code>onLongPress</code> defers activation to release: <code>onPressStart</code> and{' '}
          <code>onPressEnd</code> for a pressed visual state, and <code>onLongPress</code> for a
          hold. They fire for primary-button mouse, touch, and pen presses and for Enter and Space
          on the focused host, so a pressed state works from the keyboard and on touch where{' '}
          <code>:active</code> does not. A host that never activates, such as a focusable{' '}
          <code>div</code>, can still be pressed.
        </p>
        <p>
          <code>onPressEnd</code> follows every <code>onPressStart</code> exactly once.{' '}
          <code>cancelled</code> is <code>true</code> when the pointer left the host, the browser
          cancelled the pointer (a scroll), the host lost focus, Escape was pressed, or a long press
          consumed the press. Both callbacks receive the pointer coordinates, or the center of the
          host for keyboard presses, such as to place a ripple.
        </p>
        <CodeBlock html={lifecycleCode} />
        <p>
          Pass <code>activate: false</code> when the callbacks are only feedback, such as a pressed
          style or a ripple: the host then keeps the native click for every pointer, so nothing
          activates early.
        </p>
        <CodeBlock html={feedbackCode} />
        <Example id="hold" example={hold} />
        <p>
          <code>onLongPress</code> fires once the press has been held for{' '}
          <code>longPressDuration</code> (500ms by default) and consumes it: the release ends with{' '}
          <code>cancelled: true</code> and nothing is activated. Because an early activation could
          not be taken back, a host with <code>onLongPress</code> activates on release for every
          input: the mouse on click, and Enter on a native <code>button</code>, link,{' '}
          <code>summary</code> or button-like <code>input</code> when the key is released, by
          clicking the host so a submit button still submits with itself as the submitter and a link
          still navigates. Enter on other hosts, and any host without <code>onLongPress</code>, keep
          the browser’s own behavior. Space and assistive technology clicks are unchanged.
        </p>
        <p>
          Holding a key is not possible for everyone, and assistive technology activates with a
          click and no press at all. Offer an alternative to a long-press-only action: a plain click
          must still do something useful, or a separate control must.
        </p>
        <p>
          The click from an Enter release is untrusted (<code>isTrusted</code> is <code>false</code>
          ), with <code>detail</code> <code>0</code> and no pointer position like a keyboard click.
          It relies on the transient user activation of the key press, which Chromium, Firefox and
          WebKit keep for about five seconds, so keep <code>longPressDuration</code> under that if
          the click opens a popup, picker or other API that needs a user gesture.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="press-reference">press()</h3>
        <ApiTable id="press-options" label="Option" defaults>
          <ApiEntry name="onPressStart" type="(press: PressInfo) => void">
            Called when a press starts, before any activation. <code>press</code> has{' '}
            <code>clientX</code>, <code>clientY</code>, and <code>pointerType</code> (
            <code>'mouse'</code>, <code>'pen'</code>, <code>'touch'</code> or{' '}
            <code>'keyboard'</code>).
          </ApiEntry>
          <ApiEntry name="onPressEnd" type="(press: PressInfo & { cancelled: boolean }) => void">
            Called once for every <code>onPressStart</code>. <code>cancelled</code> is{' '}
            <code>false</code> for a release over the host.
          </ApiEntry>
          <ApiEntry name="onLongPress" type="(press: PressInfo) => void">
            Called when a press is held for <code>longPressDuration</code>. Consumes the press and
            defers activation to release, for the mouse and for Enter on a native button or link.
          </ApiEntry>
          <ApiEntry name="longPressDuration" type="number" defaultValue="500">
            Milliseconds a press is held before <code>onLongPress</code>.
          </ApiEntry>
          <ApiEntry name="activate" type="boolean" defaultValue="true">
            Whether a primary mouse press activates the host on press. <code>false</code> keeps the
            native click and only reports the lifecycle.
          </ApiEntry>
        </ApiTable>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-press" name="press" type="mixin">
            <p>A mixin factory for any HTMLElement host. The options are optional.</p>
            <CodeBlock html={pressType} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
