import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { referenceTable } from '../reference-table.tsx'

export const meta = {
  title: 'Menu',
  slug: 'menu',
  category: 'behaviors',
  description: 'Action menus with checked items, context menus and submenus.',
  importPath: '@remix-run/ui/menu',
} satisfies PageMeta

const basic = await loadExample('menu/basic')
const checkboxExample = await loadExample('menu/checkbox')
const radioExample = await loadExample('menu/radio')
const submenuExample = await loadExample('menu/submenu')

const anatomyCode = await highlightSource(`
  import * as menu from '@remix-run/ui/menu'

  <menu.Context label="Edit">
    <button type="button" mix={menu.trigger()}>Edit</button>
    <div mix={menu.popover()}>
      <div mix={menu.list()}>
        <div mix={menu.item({ name: 'copy' })}>Copy</div>
        <div mix={menu.item({ name: 'paste', disabled: true })}>Paste</div>
      </div>
    </div>
  </menu.Context>
`)

const actionsCode = await highlightSource(`
  <div mix={menu.onMenuSelect((event) => {
    if (event.item.name === 'copy') {
      copySelection()
    }
  })}>
    {/* Menu */}
  </div>
`)

const contextMenuCode = await highlightSource(`
  <menu.Context label="File actions">
    <div tabIndex={0} mix={menu.contextTrigger()}>Project brief.pdf</div>
    {/* Surface and menu items */}
  </menu.Context>
`)

const labelsCode = await highlightSource(`
  <div mix={menu.item({
    name: 'export',
    value: 'pdf',
    label: 'Export PDF',
    searchValue: ['export', 'pdf'],
  })}>
    Export PDF
  </div>
`)

export default function MenuPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <p>Wrap the trigger, floating surface and menu items in a provider.</p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="actions" title="Selection events">
        <p>
          <code>onMenuSelect()</code> receives the selected item on the menu or an ancestor.{' '}
          <code>item.name</code> identifies the action. <code>item.value</code> carries an optional
          string payload. Selection flashes the item, closes the whole menu tree and restores focus
          to the root trigger.
        </p>
        <CodeBlock html={actionsCode} />
      </Section>
      <Section id="checkbox" title="Checkbox items">
        <p>
          <code>{"type: 'checkbox'"}</code> gives an item checked semantics. Pass its current{' '}
          <code>checked</code> state and accept the next state from <code>event.item.checked</code>.
          The menu does not retain checkbox state after selection.
        </p>
        <Example id="checkbox-example" example={checkboxExample} />
      </Section>
      <Section id="radio" title="Radio items">
        <p>
          <code>{"type: 'radio'"}</code> represents mutually exclusive choices. Selection requests{' '}
          <code>{'checked: true'}</code>. Your event handler updates the chosen value and derives
          each item’s checked state. Group related items with an accessible name.
        </p>
        <Example id="radio-example" example={radioExample} />
      </Section>
      <Section id="context-menu" title="Context menus">
        <p>
          <code>contextTrigger()</code> opens at the pointer’s viewport coordinates. It also handles
          the Context Menu key and Shift+F10. Give non-button hosts a tab stop for keyboard access.
          Provide a visible button trigger for touch access.
        </p>
        <CodeBlock html={contextMenuCode} />
      </Section>
      <Section id="submenus" title="Submenus">
        <p>
          Nest a child <code>Context</code> around its <code>submenuTrigger()</code> and surface.
          The trigger registers with the parent menu and anchors the child beside it. ArrowRight
          opens a child. ArrowLeft closes it. Pointer movement uses a delay and hover aim to
          preserve the path into the child.
        </p>
        <Example id="submenu-example" example={submenuExample} />
      </Section>
      <Section id="labels" title="Labels and typeahead">
        <p>
          Items use their rendered text as the label unless <code>label</code> is provided.{' '}
          <code>searchValue</code> supplies a string or aliases for typeahead. Disabled items stay
          visible but are excluded from navigation and selection.
        </p>
        <CodeBlock html={labelsCode} />
      </Section>
      <Section id="motion" title="Selection and close feedback">
        <p>
          <code>data-menu-flash</code> marks a fixed 60 ms selection flash. The selection event
          fires at the start of the flash. The menu tree closes afterward, so event handlers run
          while the menu is still visible.
        </p>
        <p>
          Style the flash on items and the closing transition on the surface.{' '}
          <code>data-close-animation="none"</code> marks closures that should skip fading.
        </p>
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Use menus for actions rather than arbitrary form content. Arrow keys move between enabled
          items without wrapping. Home and End select the boundaries. Enter and Space activate the
          highlight. Printable keys perform typeahead. Escape closes the tree. Tab closes it without
          explicitly returning focus. A provider label names the list. Without it, the list is
          labeled by its trigger.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <p>
          Coordinates open state, focus, highlighted items and nested menus. There are no controlled
          open-state props.
        </p>
        {referenceTable(
          ['Option', 'Type', 'Behavior'],
          [
            [
              'label',
              'string',
              'Accessible menu name. Defaults to the trigger label relationship.',
            ],
            ['children', 'RemixNode', 'Trigger, surface and items.'],
          ],
        )}
        <h3 id="trigger-reference">trigger(options?)</h3>
        <p>
          Accepts <code>AnchorOptions</code>. Defaults to bottom-start placement. Click toggles the
          menu. ArrowDown opens at the first enabled item and ArrowUp at the last. Enter and Space
          focus the list.
        </p>
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [
            ['id', 'string', 'Generated trigger ID.'],
            ['aria-haspopup', 'menu', 'Menu popup semantics.'],
            ['aria-expanded', 'true | false', 'Open state.'],
            ['aria-controls', 'string', 'Generated list ID.'],
          ],
        )}
        <h3 id="context-trigger-reference">contextTrigger(options?)</h3>
        <p>
          Accepts <code>AnchorOptions</code>. Defaults to bottom-start placement. Opens from
          contextmenu or keyboard context-menu shortcuts. Adds the same ID and ARIA attributes as
          trigger(). Does not add tabIndex.
        </p>
        <h3 id="popover-reference">popover()</h3>
        <p>
          Creates a manual native popover. Root and submenu surfaces coordinate dismissal and focus.
        </p>
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [
            ['popover', 'manual', 'Native top-layer surface.'],
            ['data-menu-submenu', 'true | absent', 'Present on child surfaces.'],
            ['data-close-animation', 'none | absent', 'Skip close fading when none.'],
          ],
        )}
        <h3 id="list-reference">list()</h3>
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [
            ['role', 'menu', 'Menu semantics.'],
            ['id', 'string', 'Generated list ID.'],
            ['tabIndex', '-1', 'Programmatic focus target.'],
            ['aria-label', 'string | absent', 'Context label.'],
            ['aria-labelledby', 'string | absent', 'Trigger ID when Context has no label.'],
          ],
        )}
        <h3 id="item-reference">item(options)</h3>
        {referenceTable(
          ['Option', 'Type', 'Behavior'],
          [
            ['name', 'string', 'Required action identifier.'],
            ['value', 'string', 'Optional action payload.'],
            ['type', "'checkbox' | 'radio'", 'Omit for a regular menu item.'],
            ['checked', 'boolean', 'Current checkbox or radio state. Defaults to false.'],
            ['disabled', 'boolean', 'Defaults to false. Prevents activation.'],
            ['label', 'string', 'Event and search label. Defaults to normalized rendered text.'],
            ['searchValue', 'string | string[]', 'Typeahead text. Defaults to label.'],
          ],
        )}
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [
            ['role', 'menuitem | menuitemcheckbox | menuitemradio', 'Depends on type.'],
            ['id', 'string', 'Generated item ID.'],
            ['tabIndex', '-1', 'Focus managed by the menu.'],
            [
              'aria-checked',
              'true | false | absent',
              'Checkbox and radio state. During flash reflects requested state.',
            ],
            ['aria-disabled', 'true | absent', 'Disabled state.'],
            ['data-highlighted', 'true | absent', 'Highlighted state.'],
            ['data-menu-flash', 'true | absent', 'Temporary selection feedback.'],
          ],
        )}
        <h3 id="submenu-trigger-reference">submenuTrigger(options)</h3>
        <p>
          Must be inside the child menu provider. Accepts an options object. Defaults to right-start
          placement with inner menu-item alignment.
        </p>
        {referenceTable(
          ['Option', 'Type', 'Behavior'],
          [
            ['disabled', 'boolean', 'Disables this submenu entry.'],
            ['label', 'string', 'Search label. Defaults to rendered text.'],
            ['searchValue', 'string | string[]', 'Typeahead text. Defaults to label.'],
            ['value', 'string', 'Registered item metadata.'],
          ],
        )}
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [
            ['role', 'menuitem', 'Parent menu entry.'],
            ['id, aria-controls', 'string', 'Generated trigger and child list IDs.'],
            ['tabIndex', '-1', 'Managed focus.'],
            ['aria-haspopup', 'menu', 'Child menu semantics.'],
            ['aria-expanded', 'true | false', 'Child open state.'],
            ['aria-disabled', 'true | absent', 'Disabled state.'],
            ['data-highlighted', 'true | absent', 'Parent highlight.'],
            [
              'data-submenu-state',
              'dismissing | selecting | absent',
              'Child state. Absent while idle.',
            ],
          ],
        )}
        <h3 id="select-listener-reference">onMenuSelect(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:menu-select</code>. Receives the event and an abort signal. Capture
          defaults to false. One event bubbles from the selected item before the tree finishes
          closing.
        </p>
        <h3 id="select-event-reference">MenuSelectEvent</h3>
        <p>
          <code>item</code> contains <code>MenuSelectItem</code> metadata.
        </p>
        {referenceTable(
          ['Item property', 'Type', 'Meaning'],
          [
            ['id', 'string', 'Selected item ID.'],
            ['name', 'string', 'Action identifier.'],
            ['value', 'string | null', 'Optional payload.'],
            ['label', 'string', 'Explicit or rendered label.'],
            ['type', "'item' | 'checkbox' | 'radio'", 'Item semantics.'],
            [
              'checked',
              'boolean | undefined',
              'Requested checked state for checkbox and radio items.',
            ],
          ],
        )}
        <h3 id="types-reference">Exported types</h3>
        {referenceTable(
          ['Type', 'Purpose'],
          [
            ['MenuProviderProps', 'Provider children and label.'],
            ['MenuTriggerOptions', 'Anchor options for button triggers.'],
            ['MenuContextTriggerOptions', 'Anchor options for context-menu triggers.'],
            ['MenuItemOptions', 'Item action, semantics and search metadata.'],
            ['SubmenuTriggerOptions', 'Child trigger availability and search metadata.'],
            ['MenuSelectItem', 'Selected item data supplied by MenuSelectEvent.'],
          ],
        )}
      </Section>
    </PageLayout>
  )
}
