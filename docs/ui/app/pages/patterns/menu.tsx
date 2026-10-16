import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

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
const groupedExample = await loadExample('menu/grouped')
const contextMenuExample = await loadExample('menu/context-menu')
const submenuExample = await loadExample('menu/submenu')
const disabledExample = await loadExample('menu/disabled')

const anatomyCode = await highlightSource(`
  import * as menu from '@remix-run/ui/menu'
  import { css } from 'remix/component'

  <menu.Context>
    <button
      type="button"
      mix={[
        menu.trigger(),
        css({
          '&[aria-expanded="true"]': {},
          '&[aria-expanded="false"]': {},
          '&:focus-visible': {},
          '&:disabled': {},
        }),
      ]}
    >
      Trigger text
    </button>
    <div
      mix={[
        menu.popover(),
        css({
          '&:popover-open': {},
          '&[data-close-animation="none"]': {},
        }),
      ]}
    >
      <div mix={menu.list()}>
        <div
          mix={[
            menu.item({
              name: 'action-name',
            }),
            css({
              '&[data-highlighted]': {},
              '&[aria-disabled]': {},
              '&[data-menu-flash]': {},
            }),
          ]}
        >
          Item text
        </div>
      </div>
    </div>
  </menu.Context>
`)

const checkedItemAnatomyCode = await highlightSource(`
  <div
    mix={[
      menu.item({
        name: 'item-name',
        type: 'checkbox',
        checked,
      }),
      css({
        '&[aria-checked="true"]': {},
        '&[aria-checked="false"]': {},
        '&[data-highlighted]': {},
        '&[aria-disabled]': {},
        '&[data-menu-flash]': {},
      }),
    ]}
  >
    Checked item text
  </div>
`)

const submenuAnatomyCode = await highlightSource(`
  <menu.Context>
    <div
      mix={[
        menu.submenuTrigger({}),
        css({
          '&[aria-expanded="true"]': {},
          '&[aria-expanded="false"]': {},
          '&[aria-disabled]': {},
          '&[data-highlighted]': {},
          '&[data-submenu-state="dismissing"]': {},
          '&[data-submenu-state="selecting"]': {},
        }),
      ]}
    >
      Submenu trigger text
    </div>
    <div
      mix={[
        menu.popover(),
        css({
          '&:popover-open': {},
          '&[data-menu-submenu]': {},
          '&[data-close-animation="none"]': {},
        }),
      ]}
    >
      <div mix={menu.list()}>
        <div mix={menu.item({
          name: 'child-action-name',
        })}>
          Child item text
        </div>
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
        <CodeBlock html={anatomyCode} />
        <CodeBlock html={checkedItemAnatomyCode} />
        <CodeBlock html={submenuAnatomyCode} />
      </Section>
      <Section id="actions" title="Handling actions">
        <p>
          <code>onMenuSelect()</code> receives the selected item on the menu or an ancestor.{' '}
          <code>item.name</code> identifies the action. <code>item.value</code> carries an optional
          string payload.
        </p>
        <CodeBlock html={actionsCode} />
      </Section>
      <Section id="checkbox" title="Checkbox items">
        <p>
          <code>{"type: 'checkbox'"}</code> gives an item checked semantics. Pass its current{' '}
          <code>checked</code> state and accept the next state from <code>event.item.checked</code>.
          The application owns the checked state. Selecting a checkbox closes the menu after its
          selection feedback, just like a regular action.
        </p>
        <Example id="checkbox-example" example={checkboxExample} />
      </Section>
      <Section id="radio" title="Radio items">
        <p>
          <code>{"type: 'radio'"}</code> represents mutually exclusive choices. Selection requests{' '}
          <code>{'checked: true'}</code>. Your event handler updates the chosen value and derives
          each item’s checked state. Group related items with an accessible name. Selecting an
          already checked radio item still emits an event and closes the menu.
        </p>
        <Example id="radio-example" example={radioExample} />
      </Section>
      <Section id="grouped" title="Grouped items">
        <p>
          Organize related actions with <code>role="group"</code>. Connect each group to its visible
          heading with <code>aria-labelledby</code>, and use <code>role="separator"</code> for
          dividers. Headings and separators are not menu items. Keyboard navigation and typeahead
          move directly between the actions across groups.
        </p>
        <Example id="grouped-example" example={groupedExample} />
      </Section>
      <Section id="context-menu" title="Context menus">
        <p>
          Right-click the file to open its actions at the pointer. With the file focused, press
          Shift+F10 or the Context Menu key.
        </p>
        <Example id="context-menu-example" example={contextMenuExample} />
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
          <code>searchValue</code> supplies a string or aliases for typeahead. Items with the native{' '}
          <code>hidden</code> attribute are excluded from navigation, typeahead and selection.
          Matching ignores case and uses prefixes from <code>searchValue</code> in place of the
          label.
        </p>
        <CodeBlock html={labelsCode} />
      </Section>
      <Section id="motion" title="Selection and close feedback">
        <p>
          <code>data-menu-flash</code> marks a fixed 60 ms selection flash. The selection event
          fires at the start of the flash, while the menu is still visible. The menu tree then
          closes and focus returns to the root trigger.
        </p>
        <p>
          Style the flash on items and the closing transition on the surface.{' '}
          <code>data-close-animation="none"</code> marks closures that should skip fading.
        </p>
      </Section>
      <Section id="disabled" title="Disabled items">
        <p>
          Set <code>disabled</code> on <code>item()</code> to keep an action visible while excluding
          it from navigation, typeahead and selection.
        </p>
        <Example id="disabled-example" example={disabledExample} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Use menus for actions rather than arbitrary form content. The provider's{' '}
          <code>label</code> names the list. Without it, the trigger labels the list.
        </p>
        <ul>
          <li>Arrow keys move between enabled items without wrapping.</li>
          <li>Home and End highlight the first and last enabled items.</li>
          <li>Enter activates the highlighted item.</li>
          <li>Printable keys perform typeahead.</li>
          <li>Escape closes the menu tree.</li>
          <li>Tab closes the menu without explicitly returning focus.</li>
        </ul>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <p>Manages open state, focus, highlighted items and nested menus.</p>
        <ApiTable id="context-options" label="Option" defaults>
          <ApiEntry name="label" type="string" defaultValue="Trigger label">
            Accessible menu name.
          </ApiEntry>
          <ApiEntry name="children" type="RemixNode">
            Trigger, surface and items.
          </ApiEntry>
        </ApiTable>
        <h3 id="trigger-reference">trigger(options?)</h3>
        <p>
          Accepts <code>AnchorOptions</code>. Defaults to bottom-start placement. Click toggles the
          menu. ArrowDown opens at the first enabled item and ArrowUp at the last. Enter and Space
          focus the list.
        </p>
        <ApiTable id="trigger-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="id" type="string">
            Generated trigger ID.
          </ApiEntry>
          <ApiEntry name="aria-haspopup" type="menu">
            Menu popup semantics.
          </ApiEntry>
          <ApiEntry name="aria-expanded" type="true | false">
            Open state.
          </ApiEntry>
          <ApiEntry name="aria-controls" type="string">
            Generated list ID.
          </ApiEntry>
        </ApiTable>
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
        <ApiTable id="popover-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="popover" type="manual">
            Native top-layer surface.
          </ApiEntry>
          <ApiEntry name="data-menu-submenu" type="true | absent">
            Present on child surfaces.
          </ApiEntry>
          <ApiEntry name="data-close-animation" type="none | absent">
            Skip close fading when none.
          </ApiEntry>
        </ApiTable>
        <h3 id="list-reference">list()</h3>
        <ApiTable id="list-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="menu">
            Menu semantics.
          </ApiEntry>
          <ApiEntry name="id" type="string">
            Generated list ID.
          </ApiEntry>
          <ApiEntry name="tabIndex" type="-1">
            Programmatic focus target.
          </ApiEntry>
          <ApiEntry name="aria-label" type="string | absent">
            Context label.
          </ApiEntry>
          <ApiEntry name="aria-labelledby" type="string | absent">
            Trigger ID when Context has no label.
          </ApiEntry>
        </ApiTable>
        <h3 id="item-reference">item(options)</h3>
        <ApiTable id="item-options" label="Option" defaults>
          <ApiEntry name="name" type="string" required>
            Action identifier.
          </ApiEntry>
          <ApiEntry name="value" type="string">
            Optional action payload.
          </ApiEntry>
          <ApiEntry name="type" type="'checkbox' | 'radio'">
            Omit for a regular menu item.
          </ApiEntry>
          <ApiEntry name="checked" type="boolean" defaultValue="false">
            Current checkbox or radio state.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Prevents activation.
          </ApiEntry>
          <ApiEntry name="label" type="string" defaultValue="Rendered text">
            Event and search label.
          </ApiEntry>
          <ApiEntry name="searchValue" type="string | string[]" defaultValue="label">
            Typeahead text.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="item-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="menuitem | menuitemcheckbox | menuitemradio">
            Depends on type.
          </ApiEntry>
          <ApiEntry name="id" type="string">
            Generated item ID.
          </ApiEntry>
          <ApiEntry name="tabIndex" type="-1">
            Focus managed by the menu.
          </ApiEntry>
          <ApiEntry name="aria-checked" type="true | false | absent">
            Checkbox and radio state. During flash reflects requested state.
          </ApiEntry>
          <ApiEntry name="aria-disabled" type="true | absent">
            Disabled state.
          </ApiEntry>
          <ApiEntry name="data-highlighted" type="true | absent">
            Highlighted state.
          </ApiEntry>
          <ApiEntry name="data-menu-flash" type="true | absent">
            Temporary selection feedback.
          </ApiEntry>
        </ApiTable>
        <h3 id="submenu-trigger-reference">submenuTrigger(options)</h3>
        <p>
          Must be inside the child menu provider. Accepts an options object. Defaults to right-start
          placement with inner menu-item alignment.
        </p>
        <ApiTable id="submenu-trigger-options" label="Option" defaults>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Disables this submenu entry.
          </ApiEntry>
          <ApiEntry name="label" type="string" defaultValue="Rendered text">
            Search label.
          </ApiEntry>
          <ApiEntry name="searchValue" type="string | string[]" defaultValue="label">
            Typeahead text.
          </ApiEntry>
          <ApiEntry name="value" type="string">
            Registered item metadata.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="submenu-trigger-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="menuitem">
            Parent menu entry.
          </ApiEntry>
          <ApiEntry name="id, aria-controls" type="string">
            Generated trigger and child list IDs.
          </ApiEntry>
          <ApiEntry name="tabIndex" type="-1">
            Managed focus.
          </ApiEntry>
          <ApiEntry name="aria-haspopup" type="menu">
            Child menu semantics.
          </ApiEntry>
          <ApiEntry name="aria-expanded" type="true | false">
            Child open state.
          </ApiEntry>
          <ApiEntry name="aria-disabled" type="true | absent">
            Disabled state.
          </ApiEntry>
          <ApiEntry name="data-highlighted" type="true | absent">
            Parent highlight.
          </ApiEntry>
          <ApiEntry name="data-submenu-state" type="dismissing | selecting | absent">
            Child state. Absent while idle.
          </ApiEntry>
        </ApiTable>
        <h3 id="select-listener-reference">onMenuSelect(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:menu-select</code>. Receives the event and an abort signal. Capture
          defaults to false. One event bubbles from the selected item before the tree finishes
          closing. The event is not cancelable.
        </p>
        <h3 id="select-event-reference">MenuSelectEvent</h3>
        <p>
          <code>item</code> contains <code>MenuSelectItem</code> metadata.
        </p>
        <ApiTable id="select-event-properties" label="Item property">
          <ApiEntry name="id" type="string">
            Selected item ID.
          </ApiEntry>
          <ApiEntry name="name" type="string">
            Action identifier.
          </ApiEntry>
          <ApiEntry name="value" type="string | null">
            Optional payload.
          </ApiEntry>
          <ApiEntry name="label" type="string">
            Explicit or rendered label.
          </ApiEntry>
          <ApiEntry name="type" type="'item' | 'checkbox' | 'radio'">
            Item semantics.
          </ApiEntry>
          <ApiEntry name="checked" type="boolean | undefined">
            Requested checked state for checkbox and radio items.
          </ApiEntry>
        </ApiTable>
        <p>
          Construct with <code>new MenuSelectEvent(item)</code>.
        </p>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-MenuProviderProps" name="MenuProviderProps" type="interface">
            <p>Provider children and label.</p>
            <CodeBlock html={typeDefinitions.MenuProviderProps} />
          </ApiEntry>
          <ApiEntry id="type-MenuTriggerOptions" name="MenuTriggerOptions" type="interface">
            <p>Anchor options for button triggers.</p>
            <CodeBlock html={typeDefinitions.MenuTriggerOptions} />
          </ApiEntry>
          <ApiEntry
            id="type-MenuContextTriggerOptions"
            name="MenuContextTriggerOptions"
            type="interface"
          >
            <p>Anchor options for context-menu triggers.</p>
            <CodeBlock html={typeDefinitions.MenuContextTriggerOptions} />
          </ApiEntry>
          <ApiEntry id="type-MenuItemOptions" name="MenuItemOptions" type="interface">
            <p>Item action, semantics and search metadata.</p>
            <CodeBlock html={typeDefinitions.MenuItemOptions} />
          </ApiEntry>
          <ApiEntry id="type-SubmenuTriggerOptions" name="SubmenuTriggerOptions" type="interface">
            <p>Child trigger availability and search metadata.</p>
            <CodeBlock html={typeDefinitions.SubmenuTriggerOptions} />
          </ApiEntry>
          <ApiEntry id="type-MenuSelectItem" name="MenuSelectItem" type="interface">
            <p>Selected item data supplied by MenuSelectEvent.</p>
            <CodeBlock html={typeDefinitions.MenuSelectItem} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
