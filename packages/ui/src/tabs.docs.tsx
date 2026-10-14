import type { UiDocs } from './docs/types.ts'
import { referenceTable } from './docs/reference-table.tsx'

export default {
  title: 'Tabs',
  slug: 'tabs',
  category: 'primitives',
  description: 'Switch between related panels with keyboard navigation.',
  importPath: '@remix-run/ui/tabs',
  examples: [
    {
      id: 'basic',
      title: 'Basic',
      description: '',
      module: new URL('./tabs/basic.example.tsx', import.meta.url),
    },
    {
      id: 'controlled-example',
      title: 'Controlled',
      description: '',
      section: 'state',
      module: new URL('./tabs/controlled.example.tsx', import.meta.url),
    },
    {
      id: 'disabled-item-example',
      title: 'Disabling one tab',
      description: '',
      section: 'disabled',
      module: new URL('./tabs/disabled-item.example.tsx', import.meta.url),
    },
    {
      id: 'disabled-example',
      title: 'Disabling every tab',
      description: '',
      section: 'disabled',
      module: new URL('./tabs/disabled.example.tsx', import.meta.url),
    },
    {
      id: 'events-example',
      title: 'Events',
      description: '',
      section: 'events',
      module: new URL('./tabs/events.example.tsx', import.meta.url),
    },
  ],
  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy',
      content() {
        return (
          <p>Wrap the tab list and panels in a provider and match each tab to its panel by name.</p>
        )
      },
      code: [
        {
          source:
            "import * as tabs from '@remix-run/ui/tabs'\n\n<tabs.Context defaultActiveTab=\"overview\">\n  <div mix={tabs.root()}>\n    <div aria-label=\"Project sections\" mix={tabs.list()}>\n      <button mix={tabs.tab({ name: 'overview' })}>Overview</button>\n      <button mix={tabs.tab({ name: 'activity' })}>Activity</button>\n    </div>\n    <div mix={tabs.panel({ name: 'overview' })}>Project summary</div>\n    <div mix={tabs.panel({ name: 'activity' })}>Recent changes</div>\n  </div>\n</tabs.Context>",
        },
      ],
    },
    {
      id: 'state',
      title: 'Controlled state',
      content() {
        return (
          <p>
            <code>activeTab</code> controls selection through <code>onActiveTabChange</code>.{' '}
            <code>defaultActiveTab</code> sets an initial selection. Without either prop, the first
            enabled tab becomes active.
          </p>
        )
      },
    },
    {
      id: 'disabled',
      title: 'Disabled tabs',
      content() {
        return (
          <p>
            Set <code>disabled</code> on <code>tab()</code> to disable one tab or on{' '}
            <code>Context</code> to disable the whole group. Disabled tabs are skipped during
            navigation. Their panels keep the current selection.
          </p>
        )
      },
    },
    {
      id: 'events',
      title: 'Change events',
      content() {
        return (
          <p>
            <code>onTabsChange()</code> listens for selection changes from the root. The event
            includes <code>activeTab</code> and <code>previousActiveTab</code>. Selecting the active
            tab again does not dispatch a change.
          </p>
        )
      },
    },
    {
      id: 'context',
      title: 'Reading selection',
      content() {
        return (
          <p>
            Descendants can read the current selection from <code>Context</code>.{' '}
            <code>activateTab()</code> requests a selection using the same controlled or
            uncontrolled contract as a tab trigger.
          </p>
        )
      },
      code: [
        {
          source:
            "function ActivityLink(handle: Handle) {\n  let context = handle.context.get(tabs.Context)\n  return () => (\n    <button\n      type=\"button\"\n      disabled={context.activeTab === 'activity'}\n      mix={on('click', () => context.activateTab('activity'))}\n    >View activity</button>\n  )\n}",
        },
      ],
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      content() {
        return (
          <p>
            Arrow keys select adjacent enabled tabs and wrap at the boundaries. Home and End select
            the first and last enabled tabs. Both horizontal and vertical arrow keys are handled.
            There is no orientation option. Focus follows selection during arrow navigation.
            Inactive panels stay mounted with <code>hidden</code> and <code>inert</code>.
          </p>
        )
      },
      code: [
        {
          source:
            "<div\n  tabIndex={0}\n  mix={tabs.panel({ name: 'overview' })}\n>\n  Project summary\n</div>",
        },
      ],
    },
    {
      id: 'api-reference',
      title: 'API reference',
      content() {
        return (
          <>
            <h3 id="context-reference">Context</h3>
            <p>
              Coordinates named tabs and panels. Provides <code>TabsContextValue</code> to
              descendants.
            </p>
            {referenceTable(
              ['Option', 'Type', 'Behavior'],
              [
                ['activeTab', 'string', 'Controlled tab name.'],
                [
                  'defaultActiveTab',
                  'string',
                  'Initial tab name. Defaults to the first enabled tab after registration.',
                ],
                [
                  'onActiveTabChange',
                  '(activeTab: string) => void',
                  'Called when a different enabled tab is requested.',
                ],
                ['disabled', 'boolean', 'Disables all tabs. Defaults to false.'],
                ['children', 'RemixNode', 'Tab list and panels.'],
              ],
            )}
            {referenceTable(
              ['Provided member', 'Type or result', 'Meaning'],
              [
                [
                  'activeTab',
                  'string | null',
                  'Current selection. May be null before tabs register.',
                ],
                ['disabled', 'boolean', 'Whether the whole group is disabled.'],
                [
                  'activateTab(name)',
                  'void',
                  'Requests a tab selection. Disabled tabs and unchanged selections are ignored.',
                ],
                [
                  'activateTabInDirection(name, direction)',
                  'void',
                  'Moves focus and selection among enabled tabs.',
                ],
                ['isActiveTab(name)', 'boolean', 'Checks whether a name is selected.'],
                ['getTabId(name), getPanelId(name)', 'string', 'Generated relationship IDs.'],
                [
                  'registerRoot(node), unregisterRoot(node)',
                  'void',
                  'Root event target registration. Used by root().',
                ],
                ['registerTab(tab)', 'void', 'Tab registration. Used by tab().'],
              ],
            )}
            <h3 id="root-reference">root()</h3>
            <p>Registers the element from which change events bubble.</p>
            {referenceTable(
              ['Decoration', 'Values', 'Meaning'],
              [['data-disabled', 'empty string | absent', 'Present when Context is disabled.']],
            )}
            <h3 id="list-reference">list()</h3>
            {referenceTable(
              ['Decoration', 'Values', 'Meaning'],
              [
                ['role', 'tablist', 'Tab list semantics.'],
                ['aria-disabled', 'true | absent', 'Reflects Context disabled state.'],
              ],
            )}
            <h3 id="tab-reference">tab(options)</h3>
            {referenceTable(
              ['Option', 'Type', 'Behavior'],
              [
                ['name', 'string', 'Required. Matches a panel name.'],
                ['disabled', 'boolean', 'Disables this tab. Defaults to false.'],
              ],
            )}
            {referenceTable(
              ['Decoration', 'Values', 'Meaning'],
              [
                ['role', 'tab', 'Tab semantics.'],
                ['id, aria-controls', 'string', 'Generated tab ID and matching panel ID.'],
                ['aria-selected', 'true | false', 'Current selection.'],
                ['data-state', 'active | inactive', 'Selection styling hook.'],
                ['tabIndex', '0 | -1', 'Only the selected enabled tab is in the tab order.'],
                ['disabled', 'true | absent', 'Native disabled state.'],
                ['type', 'button', 'Applied to button hosts.'],
              ],
            )}
            <h3 id="panel-reference">panel(options)</h3>
            {referenceTable(
              ['Option', 'Type', 'Behavior'],
              [['name', 'string', 'Required. Matches a tab name.']],
            )}
            {referenceTable(
              ['Decoration', 'Values', 'Meaning'],
              [
                ['role', 'tabpanel', 'Panel semantics.'],
                ['id, aria-labelledby', 'string', 'Generated panel ID and matching tab ID.'],
                ['data-state', 'active | inactive', 'Current selection.'],
                ['hidden, inert', 'true | absent', 'Present for inactive panels.'],
              ],
            )}
            <h3 id="change-listener-reference">onTabsChange(handler, captureBoolean?)</h3>
            <p>
              Listens for <code>rmx:tabs-change</code> on a root or ancestor. Receives the event and
              an abort signal. Capture defaults to false.
            </p>
            <h3 id="change-event-reference">TabsChangeEvent</h3>
            {referenceTable(
              ['Property', 'Type', 'Meaning'],
              [
                ['activeTab', 'string', 'Requested tab name.'],
                ['previousActiveTab', 'string | null', 'Selection before the request.'],
              ],
            )}
            <h3 id="types-reference">Exported types</h3>
            {referenceTable(
              ['Type', 'Purpose'],
              [
                ['TabsContextProps', 'Provider props.'],
                ['TabsContextValue', 'State and operations supplied to descendants.'],
                ['TabOptions', 'Tab name and disabled state.'],
                ['TabPanelOptions', 'Panel name.'],
                ['TabsRegisteredTab', 'name, disabled and getTabNode() for registration.'],
                [
                  'TabsActivationDirection',
                  "'first' | 'last' | 'next' | 'previous' for directional activation.",
                ],
              ],
            )}
          </>
        )
      },
    },
  ],
} satisfies UiDocs
