import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

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
  import { css } from 'remix/component'

  <tabs.Context defaultActiveTab="tab-name">
    <div
      mix={[
        tabs.root(),
        css({
          '&[data-disabled]': {},
        }),
      ]}
    >
      <div
        aria-label="Tab list label"
        mix={[
          tabs.list(),
          css({
            '&[aria-disabled]': {},
          }),
        ]}
      >
        <button
          type="button"
          mix={[
            tabs.tab({
              name: 'tab-name',
            }),
            css({
              '&[data-state="active"]': {},
              '&[data-state="inactive"]': {},
              '&:focus-visible': {},
              '&:disabled': {},
            }),
          ]}
        >
          Tab text
        </button>
      </div>
      <div
        tabIndex={0}
        mix={[
          tabs.panel({
            name: 'tab-name',
          }),
          css({
            '&[data-state="active"]': {},
            '&[data-state="inactive"]': {},
            '&:focus-visible': {},
          }),
        ]}
      >
        Panel content
      </div>
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
    mix={tabs.panel({
      name: 'overview',
    })}
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
    <PageLayout
      page={meta}
      pages={handle.props.pages}
      intro={
        <p>
          The examples use{' '}
          <a href="/animation/layout/">
            <code>animateLayout()</code>
          </a>{' '}
          to move the selection indicator and{' '}
          <a href="/animation/reduced-motion/">
            <code>prefersReducedMotion()</code>
          </a>{' '}
          to skip that motion when requested.
        </p>
      }
    >
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="state" title="Controlled state">
        <p>
          Pass <code>activeTab</code> and update it in <code>onActiveTabChange</code> to control
          selection. Without <code>activeTab</code>, the provider manages state, starting from{' '}
          <code>defaultActiveTab</code> or the first enabled tab.
        </p>
        <Example id="controlled-example" example={controlledExample} />
        <h3 id="context">Reading selection</h3>
        <p>
          Descendants can read the current selection from <code>Context</code>.{' '}
          <code>activateTab()</code> requests a selection using the same controlled or uncontrolled
          contract as a tab trigger.
        </p>
        <CodeBlock html={contextCode} />
      </Section>
      <Section id="events" title="Change events">
        <p>
          <code>onTabsChange()</code> listens for selection changes from the root. The event
          includes <code>activeTab</code> and <code>previousActiveTab</code>. Selecting the active
          tab again does not dispatch a change.
        </p>
        <CodeBlock html={eventsCode} />
      </Section>
      <Section id="disabled" title="Disabled tabs">
        <p>
          Set <code>disabled</code> on <code>tab()</code> to disable one tab or on{' '}
          <code>Context</code> to disable the whole group. Disabled tabs are skipped during
          navigation. Disabling a tab does not change the current selection.
        </p>
        <CodeBlock html={disabledCode} />
        <Example id="disabled-item-example" example={disabledItemExample} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Inactive panels stay mounted with <code>hidden</code> and <code>inert</code>. Focus
          follows selection during arrow navigation.
        </p>
        <ul>
          <li>Arrow keys select adjacent enabled tabs and wrap at the boundaries.</li>
          <li>Home and End select the first and last enabled tabs.</li>
        </ul>
        <p>Both horizontal and vertical arrow keys are handled.</p>
        <p>
          Give a panel <code>tabIndex=0</code> when its content begins with text or another
          non-focusable element, so keyboard users can Tab from the selected tab into the panel.
          Keep its focus indicator visible. When the first meaningful element is already focusable,
          it can provide that entry point instead.
        </p>
        <CodeBlock html={accessibilityCode} />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <p>
          Coordinates named tabs and panels. Provides <code>TabsContextValue</code> to descendants.
        </p>
        <ApiTable id="context-options" label="Option" defaults>
          <ApiEntry name="activeTab" type="string">
            Controlled tab name.
          </ApiEntry>
          <ApiEntry name="defaultActiveTab" type="string" defaultValue="First enabled tab">
            Initial tab name.
          </ApiEntry>
          <ApiEntry name="onActiveTabChange" type="(activeTab: string) => void">
            Called when a different enabled tab is requested.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Disables all tabs.
          </ApiEntry>
          <ApiEntry name="children" type="RemixNode">
            Tab list and panels.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="context-state" label="Provided member">
          <ApiEntry name="activeTab" type="string | null">
            Current selection. May be null before tabs register.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean">
            Whether the whole group is disabled.
          </ApiEntry>
          <ApiEntry name="activateTab" type="(name: string) => void">
            Requests a tab selection. Disabled tabs and unchanged selections are ignored.
          </ApiEntry>
          <ApiEntry
            name="activateTabInDirection"
            type="(name: string, direction: TabsActivationDirection) => void"
          >
            Moves focus and selection among enabled tabs.
          </ApiEntry>
          <ApiEntry name="isActiveTab" type="(name: string) => boolean">
            Checks whether a name is selected.
          </ApiEntry>
          <ApiEntry name="getTabId" type="(name: string) => string">
            Generated tab ID for a name.
          </ApiEntry>
          <ApiEntry name="getPanelId" type="(name: string) => string">
            Generated panel ID for a name.
          </ApiEntry>
          <ApiEntry name="registerRoot" type="(node: HTMLElement) => void">
            Registers the root event target. Used by root().
          </ApiEntry>
          <ApiEntry name="unregisterRoot" type="(node: HTMLElement) => void">
            Unregisters the root event target. Used by root().
          </ApiEntry>
          <ApiEntry name="registerTab" type="(tab: TabsRegisteredTab) => void">
            Tab registration. Used by tab().
          </ApiEntry>
        </ApiTable>
        <h3 id="root-reference">root()</h3>
        <p>Registers the element from which change events bubble.</p>
        <ApiTable id="root-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="data-disabled" type="empty string | absent">
            Present when Context is disabled.
          </ApiEntry>
        </ApiTable>
        <h3 id="list-reference">list()</h3>
        <ApiTable id="list-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="tablist">
            Tab list semantics.
          </ApiEntry>
          <ApiEntry name="aria-disabled" type="true | absent">
            Reflects Context disabled state.
          </ApiEntry>
        </ApiTable>
        <h3 id="tab-reference">tab(options)</h3>
        <ApiTable id="tab-options" label="Option" defaults>
          <ApiEntry name="name" type="string" required>
            Identifier unique within the tab list. Matches a panel name.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Disables this tab.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="tab-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="tab">
            Tab semantics.
          </ApiEntry>
          <ApiEntry name="id, aria-controls" type="string">
            Generated tab ID and matching panel ID.
          </ApiEntry>
          <ApiEntry name="aria-selected" type="true | false">
            Current selection.
          </ApiEntry>
          <ApiEntry name="data-state" type="active | inactive">
            Selection styling hook.
          </ApiEntry>
          <ApiEntry name="tabIndex" type="0 | -1">
            Only the selected enabled tab is in the tab order.
          </ApiEntry>
          <ApiEntry name="disabled" type="true | absent">
            Native disabled state.
          </ApiEntry>
          <ApiEntry name="type" type="button">
            Applied to button hosts.
          </ApiEntry>
        </ApiTable>
        <h3 id="panel-reference">panel(options)</h3>
        <ApiTable id="panel-options" label="Option">
          <ApiEntry name="name" type="string" required>
            Matches a tab name.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="panel-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="tabpanel">
            Panel semantics.
          </ApiEntry>
          <ApiEntry name="id, aria-labelledby" type="string">
            Generated panel ID and matching tab ID.
          </ApiEntry>
          <ApiEntry name="data-state" type="active | inactive">
            Current selection.
          </ApiEntry>
          <ApiEntry name="hidden, inert" type="true | absent">
            Present for inactive panels.
          </ApiEntry>
        </ApiTable>
        <h3 id="change-listener-reference">onTabsChange(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:tabs-change</code> on a root or ancestor. Receives the event and an
          abort signal. Capture defaults to false.
        </p>
        <h3 id="change-event-reference">TabsChangeEvent</h3>
        <ApiTable id="change-event-properties" label="Property">
          <ApiEntry name="activeTab" type="string">
            Requested tab name.
          </ApiEntry>
          <ApiEntry name="previousActiveTab" type="string | null">
            Selection before the request.
          </ApiEntry>
        </ApiTable>
        <p>
          Dispatched after <code>onActiveTabChange</code>. In controlled mode, it reports a request
          even if the application leaves <code>activeTab</code> unchanged. Updating the prop
          directly does not dispatch an event. The event is not cancelable.
        </p>
        <p>
          Construct with <code>new TabsChangeEvent(activeTab, previousActiveTab)</code>.
        </p>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-TabsContextProps" name="TabsContextProps" type="interface">
            <p>Provider props.</p>
            <CodeBlock html={typeDefinitions.TabsContextProps} />
          </ApiEntry>
          <ApiEntry id="type-TabsContextValue" name="TabsContextValue" type="interface">
            <p>State and operations supplied to descendants.</p>
            <CodeBlock html={typeDefinitions.TabsContextValue} />
          </ApiEntry>
          <ApiEntry id="type-TabOptions" name="TabOptions" type="interface">
            <p>Tab name and disabled state.</p>
            <CodeBlock html={typeDefinitions.TabOptions} />
          </ApiEntry>
          <ApiEntry id="type-TabPanelOptions" name="TabPanelOptions" type="interface">
            <p>Panel name.</p>
            <CodeBlock html={typeDefinitions.TabPanelOptions} />
          </ApiEntry>
          <ApiEntry id="type-TabsRegisteredTab" name="TabsRegisteredTab" type="interface">
            <p>Name, disabled and getTabNode() for registration.</p>
            <CodeBlock html={typeDefinitions.TabsRegisteredTab} />
          </ApiEntry>
          <ApiEntry
            id="type-TabsActivationDirection"
            name="TabsActivationDirection"
            type="'first' | 'last' | 'next' | 'previous'"
          >
            <p>'first' | 'last' | 'next' | 'previous' for directional activation.</p>
            <CodeBlock html={typeDefinitions.TabsActivationDirection} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
