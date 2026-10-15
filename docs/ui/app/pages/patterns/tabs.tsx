import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Tabs',
  slug: 'tabs',
  category: 'patterns',
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

const typeDefinitions = {
  TabsContextProps: await highlightSource(
    `export interface TabsContextProps {
  activeTab?: string
  children?: RemixNode
  defaultActiveTab?: string
  disabled?: boolean
  onActiveTabChange?: (activeTab: string) => void
}`,
  ),
  TabsContextValue: await highlightSource(
    `export interface TabsContextValue {
  readonly activeTab: string | null
  readonly disabled: boolean
  activateTab(name: string): void
  activateTabInDirection(name: string, direction: TabsActivationDirection): void
  getPanelId(name: string): string
  getTabId(name: string): string
  isActiveTab(name: string): boolean
  registerRoot(node: HTMLElement): void
  registerTab(tab: TabsRegisteredTab): void
  unregisterRoot(node: HTMLElement): void
}`,
  ),
  TabOptions: await highlightSource(
    `export interface TabOptions {
  disabled?: boolean
  name: string
}`,
  ),
  TabPanelOptions: await highlightSource(
    `export interface TabPanelOptions {
  name: string
}`,
  ),
  TabsRegisteredTab: await highlightSource(
    `export interface TabsRegisteredTab {
  disabled: boolean
  getTabNode(): HTMLButtonElement | null
  name: string
}`,
  ),
  TabsActivationDirection: await highlightSource(
    `export type TabsActivationDirection = 'first' | 'last' | 'next' | 'previous'`,
  ),
}

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
        <ApiTable
          label="Option"
          defaults
          entries={[
            {
              name: 'activeTab',
              type: <code>{'string'}</code>,
              description: 'Controlled tab name.',
            },
            {
              name: 'defaultActiveTab',
              type: <code>{'string'}</code>,
              description: 'Initial tab name.',
              defaultValue: <code>{'First enabled tab'}</code>,
            },
            {
              name: 'onActiveTabChange',
              type: <code>{'(activeTab: string) => void'}</code>,
              description: 'Called when a different enabled tab is requested.',
            },
            {
              name: 'disabled',
              type: <code>{'boolean'}</code>,
              description: 'Disables all tabs.',
              defaultValue: <code>{'false'}</code>,
            },
            {
              name: 'children',
              type: <code>{'RemixNode'}</code>,
              description: 'Tab list and panels.',
            },
          ]}
        />
        <ApiTable
          label="Provided member"
          entries={[
            {
              name: 'activeTab',
              type: <code>{'string | null'}</code>,
              description: 'Current selection. May be null before tabs register.',
            },
            {
              name: 'disabled',
              type: <code>{'boolean'}</code>,
              description: 'Whether the whole group is disabled.',
            },
            {
              name: 'activateTab',
              type: <code>{'(name: string) => void'}</code>,
              description:
                'Requests a tab selection. Disabled tabs and unchanged selections are ignored.',
            },
            {
              name: 'activateTabInDirection',
              type: <code>{'(name: string, direction: TabsActivationDirection) => void'}</code>,
              description: 'Moves focus and selection among enabled tabs.',
            },
            {
              name: 'isActiveTab',
              type: <code>{'(name: string) => boolean'}</code>,
              description: 'Checks whether a name is selected.',
            },
            {
              name: 'getTabId',
              type: <code>{'(name: string) => string'}</code>,
              description: 'Generated tab ID for a name.',
            },
            {
              name: 'getPanelId',
              type: <code>{'(name: string) => string'}</code>,
              description: 'Generated panel ID for a name.',
            },
            {
              name: 'registerRoot',
              type: <code>{'(node: HTMLElement) => void'}</code>,
              description: 'Registers the root event target. Used by root().',
            },
            {
              name: 'unregisterRoot',
              type: <code>{'(node: HTMLElement) => void'}</code>,
              description: 'Unregisters the root event target. Used by root().',
            },
            {
              name: 'registerTab',
              type: <code>{'(tab: TabsRegisteredTab) => void'}</code>,
              description: 'Tab registration. Used by tab().',
            },
          ]}
        />
        <h3 id="root-reference">root()</h3>
        <p>Registers the element from which change events bubble.</p>
        <ApiTable
          label="Attribute"
          typeLabel="Value"
          entries={[
            {
              name: 'data-disabled',
              type: <code>{'empty string | absent'}</code>,
              description: 'Present when Context is disabled.',
            },
          ]}
        />
        <h3 id="list-reference">list()</h3>
        <ApiTable
          label="Attribute"
          typeLabel="Value"
          entries={[
            { name: 'role', type: <code>{'tablist'}</code>, description: 'Tab list semantics.' },
            {
              name: 'aria-disabled',
              type: <code>{'true | absent'}</code>,
              description: 'Reflects Context disabled state.',
            },
          ]}
        />
        <h3 id="tab-reference">tab(options)</h3>
        <ApiTable
          label="Option"
          defaults
          entries={[
            {
              name: 'name',
              type: <code>{'string'}</code>,
              description: 'Matches a panel name.',
              required: true,
            },
            {
              name: 'disabled',
              type: <code>{'boolean'}</code>,
              description: 'Disables this tab.',
              defaultValue: <code>{'false'}</code>,
            },
          ]}
        />
        <ApiTable
          label="Attribute"
          typeLabel="Value"
          entries={[
            { name: 'role', type: <code>{'tab'}</code>, description: 'Tab semantics.' },
            {
              name: 'id, aria-controls',
              type: <code>{'string'}</code>,
              description: 'Generated tab ID and matching panel ID.',
            },
            {
              name: 'aria-selected',
              type: <code>{'true | false'}</code>,
              description: 'Current selection.',
            },
            {
              name: 'data-state',
              type: <code>{'active | inactive'}</code>,
              description: 'Selection styling hook.',
            },
            {
              name: 'tabIndex',
              type: <code>{'0 | -1'}</code>,
              description: 'Only the selected enabled tab is in the tab order.',
            },
            {
              name: 'disabled',
              type: <code>{'true | absent'}</code>,
              description: 'Native disabled state.',
            },
            {
              name: 'type',
              type: <code>{'button'}</code>,
              description: 'Applied to button hosts.',
            },
          ]}
        />
        <h3 id="panel-reference">panel(options)</h3>
        <ApiTable
          label="Option"
          entries={[
            {
              name: 'name',
              type: <code>{'string'}</code>,
              description: 'Matches a tab name.',
              required: true,
            },
          ]}
        />
        <ApiTable
          label="Attribute"
          typeLabel="Value"
          entries={[
            { name: 'role', type: <code>{'tabpanel'}</code>, description: 'Panel semantics.' },
            {
              name: 'id, aria-labelledby',
              type: <code>{'string'}</code>,
              description: 'Generated panel ID and matching tab ID.',
            },
            {
              name: 'data-state',
              type: <code>{'active | inactive'}</code>,
              description: 'Current selection.',
            },
            {
              name: 'hidden, inert',
              type: <code>{'true | absent'}</code>,
              description: 'Present for inactive panels.',
            },
          ]}
        />
        <h3 id="change-listener-reference">onTabsChange(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:tabs-change</code> on a root or ancestor. Receives the event and an
          abort signal. Capture defaults to false.
        </p>
        <h3 id="change-event-reference">TabsChangeEvent</h3>
        <ApiTable
          label="Property"
          entries={[
            {
              name: 'activeTab',
              type: <code>{'string'}</code>,
              description: 'Requested tab name.',
            },
            {
              name: 'previousActiveTab',
              type: <code>{'string | null'}</code>,
              description: 'Selection before the request.',
            },
          ]}
        />
        <h3 id="types-reference">Exported types</h3>
        <ApiTable
          detailsLabel="Definition"
          entries={[
            {
              name: 'TabsContextProps',
              type: <code>{'interface'}</code>,
              description: 'Provider props.',
              id: 'type-TabsContextProps',
              details: <CodeBlock html={typeDefinitions.TabsContextProps} />,
            },
            {
              name: 'TabsContextValue',
              type: <code>{'interface'}</code>,
              description: 'State and operations supplied to descendants.',
              id: 'type-TabsContextValue',
              details: <CodeBlock html={typeDefinitions.TabsContextValue} />,
            },
            {
              name: 'TabOptions',
              type: <code>{'interface'}</code>,
              description: 'Tab name and disabled state.',
              id: 'type-TabOptions',
              details: <CodeBlock html={typeDefinitions.TabOptions} />,
            },
            {
              name: 'TabPanelOptions',
              type: <code>{'interface'}</code>,
              description: 'Panel name.',
              id: 'type-TabPanelOptions',
              details: <CodeBlock html={typeDefinitions.TabPanelOptions} />,
            },
            {
              name: 'TabsRegisteredTab',
              type: <code>{'interface'}</code>,
              description: 'Name, disabled and getTabNode() for registration.',
              id: 'type-TabsRegisteredTab',
              details: <CodeBlock html={typeDefinitions.TabsRegisteredTab} />,
            },
            {
              name: 'TabsActivationDirection',
              type: <code>{"'first' | 'last' | 'next' | 'previous'"}</code>,
              description: "'first' | 'last' | 'next' | 'previous' for directional activation.",
              id: 'type-TabsActivationDirection',
              details: <CodeBlock html={typeDefinitions.TabsActivationDirection} />,
            },
          ]}
        />
      </Section>
    </PageLayout>
  )
}
