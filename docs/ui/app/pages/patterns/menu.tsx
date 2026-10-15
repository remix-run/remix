import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Menu',
  slug: 'menu',
  category: 'patterns',
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

const typeDefinitions = {
  MenuProviderProps: await highlightSource(
    `export interface MenuProviderProps {
  children?: RemixNode
  label?: string
}`,
  ),
  MenuTriggerOptions: await highlightSource(
    `export interface MenuTriggerOptions extends AnchorOptions {}`,
  ),
  MenuContextTriggerOptions: await highlightSource(
    `export interface MenuContextTriggerOptions extends AnchorOptions {}`,
  ),
  MenuItemOptions: await highlightSource(
    `export interface MenuItemOptions {
  checked?: boolean
  disabled?: boolean
  label?: string
  name: string
  searchValue?: string | string[]
  type?: 'checkbox' | 'radio'
  value?: string
}`,
  ),
  SubmenuTriggerOptions: await highlightSource(
    `export interface SubmenuTriggerOptions {
  disabled?: boolean
  label?: string
  searchValue?: string | string[]
  value?: string
}`,
  ),
  MenuSelectItem: await highlightSource(
    `export interface MenuSelectItem {
  checked?: boolean
  id: string
  label: string
  name: string
  type: 'item' | 'checkbox' | 'radio'
  value: string | null
}`,
  ),
}

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
        <ApiTable
          label="Option"
          defaults
          entries={[
            {
              name: 'label',
              type: <code>{'string'}</code>,
              description: 'Accessible menu name.',
              defaultValue: <code>{'Trigger label'}</code>,
            },
            {
              name: 'children',
              type: <code>{'RemixNode'}</code>,
              description: 'Trigger, surface and items.',
            },
          ]}
        />
        <h3 id="trigger-reference">trigger(options?)</h3>
        <p>
          Accepts <code>AnchorOptions</code>. Defaults to bottom-start placement. Click toggles the
          menu. ArrowDown opens at the first enabled item and ArrowUp at the last. Enter and Space
          focus the list.
        </p>
        <ApiTable
          label="Attribute"
          typeLabel="Value"
          entries={[
            { name: 'id', type: <code>{'string'}</code>, description: 'Generated trigger ID.' },
            {
              name: 'aria-haspopup',
              type: <code>{'menu'}</code>,
              description: 'Menu popup semantics.',
            },
            {
              name: 'aria-expanded',
              type: <code>{'true | false'}</code>,
              description: 'Open state.',
            },
            {
              name: 'aria-controls',
              type: <code>{'string'}</code>,
              description: 'Generated list ID.',
            },
          ]}
        />
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
        <ApiTable
          label="Attribute"
          typeLabel="Value"
          entries={[
            {
              name: 'popover',
              type: <code>{'manual'}</code>,
              description: 'Native top-layer surface.',
            },
            {
              name: 'data-menu-submenu',
              type: <code>{'true | absent'}</code>,
              description: 'Present on child surfaces.',
            },
            {
              name: 'data-close-animation',
              type: <code>{'none | absent'}</code>,
              description: 'Skip close fading when none.',
            },
          ]}
        />
        <h3 id="list-reference">list()</h3>
        <ApiTable
          label="Attribute"
          typeLabel="Value"
          entries={[
            { name: 'role', type: <code>{'menu'}</code>, description: 'Menu semantics.' },
            { name: 'id', type: <code>{'string'}</code>, description: 'Generated list ID.' },
            {
              name: 'tabIndex',
              type: <code>{'-1'}</code>,
              description: 'Programmatic focus target.',
            },
            {
              name: 'aria-label',
              type: <code>{'string | absent'}</code>,
              description: 'Context label.',
            },
            {
              name: 'aria-labelledby',
              type: <code>{'string | absent'}</code>,
              description: 'Trigger ID when Context has no label.',
            },
          ]}
        />
        <h3 id="item-reference">item(options)</h3>
        <ApiTable
          label="Option"
          defaults
          entries={[
            {
              name: 'name',
              type: <code>{'string'}</code>,
              description: 'Action identifier.',
              required: true,
            },
            {
              name: 'value',
              type: <code>{'string'}</code>,
              description: 'Optional action payload.',
            },
            {
              name: 'type',
              type: <code>{"'checkbox' | 'radio'"}</code>,
              description: 'Omit for a regular menu item.',
            },
            {
              name: 'checked',
              type: <code>{'boolean'}</code>,
              description: 'Current checkbox or radio state.',
              defaultValue: <code>{'false'}</code>,
            },
            {
              name: 'disabled',
              type: <code>{'boolean'}</code>,
              description: 'Prevents activation.',
              defaultValue: <code>{'false'}</code>,
            },
            {
              name: 'label',
              type: <code>{'string'}</code>,
              description: 'Event and search label.',
              defaultValue: <code>{'Rendered text'}</code>,
            },
            {
              name: 'searchValue',
              type: <code>{'string | string[]'}</code>,
              description: 'Typeahead text.',
              defaultValue: <code>{'label'}</code>,
            },
          ]}
        />
        <ApiTable
          label="Attribute"
          typeLabel="Value"
          entries={[
            {
              name: 'role',
              type: <code>{'menuitem | menuitemcheckbox | menuitemradio'}</code>,
              description: 'Depends on type.',
            },
            { name: 'id', type: <code>{'string'}</code>, description: 'Generated item ID.' },
            {
              name: 'tabIndex',
              type: <code>{'-1'}</code>,
              description: 'Focus managed by the menu.',
            },
            {
              name: 'aria-checked',
              type: <code>{'true | false | absent'}</code>,
              description: 'Checkbox and radio state. During flash reflects requested state.',
            },
            {
              name: 'aria-disabled',
              type: <code>{'true | absent'}</code>,
              description: 'Disabled state.',
            },
            {
              name: 'data-highlighted',
              type: <code>{'true | absent'}</code>,
              description: 'Highlighted state.',
            },
            {
              name: 'data-menu-flash',
              type: <code>{'true | absent'}</code>,
              description: 'Temporary selection feedback.',
            },
          ]}
        />
        <h3 id="submenu-trigger-reference">submenuTrigger(options)</h3>
        <p>
          Must be inside the child menu provider. Accepts an options object. Defaults to right-start
          placement with inner menu-item alignment.
        </p>
        <ApiTable
          label="Option"
          defaults
          entries={[
            {
              name: 'disabled',
              type: <code>{'boolean'}</code>,
              description: 'Disables this submenu entry.',
              defaultValue: <code>{'false'}</code>,
            },
            {
              name: 'label',
              type: <code>{'string'}</code>,
              description: 'Search label.',
              defaultValue: <code>{'Rendered text'}</code>,
            },
            {
              name: 'searchValue',
              type: <code>{'string | string[]'}</code>,
              description: 'Typeahead text.',
              defaultValue: <code>{'label'}</code>,
            },
            {
              name: 'value',
              type: <code>{'string'}</code>,
              description: 'Registered item metadata.',
            },
          ]}
        />
        <ApiTable
          label="Attribute"
          typeLabel="Value"
          entries={[
            { name: 'role', type: <code>{'menuitem'}</code>, description: 'Parent menu entry.' },
            {
              name: 'id, aria-controls',
              type: <code>{'string'}</code>,
              description: 'Generated trigger and child list IDs.',
            },
            { name: 'tabIndex', type: <code>{'-1'}</code>, description: 'Managed focus.' },
            {
              name: 'aria-haspopup',
              type: <code>{'menu'}</code>,
              description: 'Child menu semantics.',
            },
            {
              name: 'aria-expanded',
              type: <code>{'true | false'}</code>,
              description: 'Child open state.',
            },
            {
              name: 'aria-disabled',
              type: <code>{'true | absent'}</code>,
              description: 'Disabled state.',
            },
            {
              name: 'data-highlighted',
              type: <code>{'true | absent'}</code>,
              description: 'Parent highlight.',
            },
            {
              name: 'data-submenu-state',
              type: <code>{'dismissing | selecting | absent'}</code>,
              description: 'Child state. Absent while idle.',
            },
          ]}
        />
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
        <ApiTable
          label="Item property"
          entries={[
            { name: 'id', type: <code>{'string'}</code>, description: 'Selected item ID.' },
            { name: 'name', type: <code>{'string'}</code>, description: 'Action identifier.' },
            {
              name: 'value',
              type: <code>{'string | null'}</code>,
              description: 'Optional payload.',
            },
            {
              name: 'label',
              type: <code>{'string'}</code>,
              description: 'Explicit or rendered label.',
            },
            {
              name: 'type',
              type: <code>{"'item' | 'checkbox' | 'radio'"}</code>,
              description: 'Item semantics.',
            },
            {
              name: 'checked',
              type: <code>{'boolean | undefined'}</code>,
              description: 'Requested checked state for checkbox and radio items.',
            },
          ]}
        />
        <h3 id="types-reference">Exported types</h3>
        <ApiTable
          detailsLabel="Definition"
          entries={[
            {
              name: 'MenuProviderProps',
              type: <code>{'interface'}</code>,
              description: 'Provider children and label.',
              id: 'type-MenuProviderProps',
              details: <CodeBlock html={typeDefinitions.MenuProviderProps} />,
            },
            {
              name: 'MenuTriggerOptions',
              type: <code>{'interface'}</code>,
              description: 'Anchor options for button triggers.',
              id: 'type-MenuTriggerOptions',
              details: <CodeBlock html={typeDefinitions.MenuTriggerOptions} />,
            },
            {
              name: 'MenuContextTriggerOptions',
              type: <code>{'interface'}</code>,
              description: 'Anchor options for context-menu triggers.',
              id: 'type-MenuContextTriggerOptions',
              details: <CodeBlock html={typeDefinitions.MenuContextTriggerOptions} />,
            },
            {
              name: 'MenuItemOptions',
              type: <code>{'interface'}</code>,
              description: 'Item action, semantics and search metadata.',
              id: 'type-MenuItemOptions',
              details: <CodeBlock html={typeDefinitions.MenuItemOptions} />,
            },
            {
              name: 'SubmenuTriggerOptions',
              type: <code>{'interface'}</code>,
              description: 'Child trigger availability and search metadata.',
              id: 'type-SubmenuTriggerOptions',
              details: <CodeBlock html={typeDefinitions.SubmenuTriggerOptions} />,
            },
            {
              name: 'MenuSelectItem',
              type: <code>{'interface'}</code>,
              description: 'Selected item data supplied by MenuSelectEvent.',
              id: 'type-MenuSelectItem',
              details: <CodeBlock html={typeDefinitions.MenuSelectItem} />,
            },
          ]}
        />
      </Section>
    </PageLayout>
  )
}
