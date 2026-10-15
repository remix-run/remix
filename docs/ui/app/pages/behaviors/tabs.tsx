import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { referenceTable } from '../reference-table.tsx'

export const meta = {
  title: 'Tabs',
  slug: 'tabs',
  category: 'behaviors',
  description: 'Switch between related panels with keyboard navigation.',
  importPath: '@remix-run/ui/tabs',
} satisfies PageMeta

const basic = await loadExample('tabs/basic')
const controlledExample = await loadExample('tabs/controlled')
const disabledItemExample = await loadExample('tabs/disabled-item')

const anatomyCode = await highlightSource(`
  import * as tabs from '@remix-run/ui/tabs'

  <tabs.Context defaultActiveTab="overview">
    <div mix={tabs.root()}>
      <div aria-label="Project sections" mix={tabs.list()}>
        <button mix={tabs.tab({ name: 'overview' })}>Overview</button>
        <button mix={tabs.tab({ name: 'activity' })}>Activity</button>
      </div>
      <div mix={tabs.panel({ name: 'overview' })}>Project summary</div>
      <div mix={tabs.panel({ name: 'activity' })}>Recent changes</div>
    </div>
  </tabs.Context>
`)

const disabledCode = await highlightSource(`
  <tabs.Context defaultActiveTab="details" disabled>
    {/* All tab triggers are disabled. The selected panel stays visible. */}
  </tabs.Context>
`)

const eventsCode = await highlightSource(`
  <div mix={tabs.onTabsChange((event) => {
    recordTabChange(event.activeTab, event.previousActiveTab)
  })}>
    {/* Tabs */}
  </div>
`)

const contextCode = await highlightSource(`
  function ActivityLink(handle: Handle) {
    let context = handle.context.get(tabs.Context)
    return () => (
      <button
        type="button"
        disabled={context.activeTab === 'activity'}
        mix={on('click', () => context.activateTab('activity'))}
      >View activity</button>
    )
  }
`)

const accessibilityCode = await highlightSource(`
  <div
    tabIndex={0}
    mix={tabs.panel({ name: 'overview' })}
  >
    Project summary
  </div>
`)

export default function TabsPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <p>Wrap the tab list and panels in a provider and match each tab to its panel by name.</p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="state" title="Controlled state">
        <p>
          <code>activeTab</code> controls selection through <code>onActiveTabChange</code>.{' '}
          <code>defaultActiveTab</code> sets an initial selection. Without either prop, the first
          enabled tab becomes active.
        </p>
        <Example id="controlled-example" example={controlledExample} />
      </Section>
      <Section id="disabled" title="Disabled tabs">
        <p>
          Set <code>disabled</code> on <code>tab()</code> to disable one tab or on{' '}
          <code>Context</code> to disable the whole group. Disabled tabs are skipped during
          navigation. Their panels keep the current selection.
        </p>
        <CodeBlock html={disabledCode} />
        <Example id="disabled-item-example" example={disabledItemExample} />
      </Section>
      <Section id="events" title="Change events">
        <p>
          <code>onTabsChange()</code> listens for selection changes from the root. The event
          includes <code>activeTab</code> and <code>previousActiveTab</code>. Selecting the active
          tab again does not dispatch a change.
        </p>
        <CodeBlock html={eventsCode} />
      </Section>
      <Section id="context" title="Reading selection">
        <p>
          Descendants can read the current selection from <code>Context</code>.{' '}
          <code>activateTab()</code> requests a selection using the same controlled or uncontrolled
          contract as a tab trigger.
        </p>
        <CodeBlock html={contextCode} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Arrow keys select adjacent enabled tabs and wrap at the boundaries. Home and End select
          the first and last enabled tabs. Both horizontal and vertical arrow keys are handled.
          There is no orientation option. Focus follows selection during arrow navigation. Inactive
          panels stay mounted with <code>hidden</code> and <code>inert</code>.
        </p>
        <CodeBlock html={accessibilityCode} />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <p>
          Coordinates named tabs and panels. Provides <code>TabsContextValue</code> to descendants.
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
            ['activeTab', 'string | null', 'Current selection. May be null before tabs register.'],
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
          Listens for <code>rmx:tabs-change</code> on a root or ancestor. Receives the event and an
          abort signal. Capture defaults to false.
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
      </Section>
    </PageLayout>
  )
}
