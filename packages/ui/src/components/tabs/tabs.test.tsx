import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, css, type Handle, type RemixNode } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'

import {
  onTabsChange,
  Tab,
  Tabs,
  TabsChangeEvent,
  TabsList,
  TabsPanel,
  type TabsProps,
} from './tabs.tsx'
import * as tabs from './tabs.tsx'

let roots: ReturnType<typeof createRoot>[] = []

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  root.flush()
  roots.push(root)
  return { container, root }
}

function renderExampleTabs(props: TabsProps = {}) {
  return (
    <Tabs {...props}>
      <TabsList aria-label="Project sections">
        <Tab value="overview">Overview</Tab>
        <Tab disabled value="analytics">
          Analytics
        </Tab>
        <Tab value="reports">Reports</Tab>
        <Tab value="settings">Settings</Tab>
      </TabsList>

      <TabsPanel value="overview">Overview panel</TabsPanel>
      <TabsPanel value="analytics">Analytics panel</TabsPanel>
      <TabsPanel value="reports">Reports panel</TabsPanel>
      <TabsPanel value="settings">Settings panel</TabsPanel>
    </Tabs>
  )
}

function getTabByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).find(
    (tab) => tab.textContent?.trim() === text,
  ) as HTMLElement
}

function getPanelByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="tabpanel"]')).find(
    (panel) => panel.textContent?.trim() === text,
  ) as HTMLElement
}

function key(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
}

function activate(target: HTMLElement) {
  target.click()
}

describe('Tabs', () => {
  it('selects the first enabled tab by default and wires the tab and panel aria relationships', () => {
    let { container } = renderApp(renderExampleTabs())

    let overview = getTabByText(container, 'Overview')
    let analytics = getTabByText(container, 'Analytics')
    let reportsPanel = getPanelByText(container, 'Reports panel')
    let overviewPanel = getPanelByText(container, 'Overview panel')

    expect(overview.getAttribute('aria-selected')).toBe('true')
    expect(overview.tabIndex).toBe(0)
    expect(overview.getAttribute('aria-controls')).toBe(overviewPanel.id)
    expect(overviewPanel.getAttribute('aria-labelledby')).toBe(overview.id)
    expect(overviewPanel.hidden).toBe(false)
    expect(reportsPanel.hidden).toBe(true)
    expect(analytics.getAttribute('aria-disabled')).toBe('true')
    expect(analytics.tabIndex).toBe(-1)
  })

  it('supports controlled selection changes through onValueChange', () => {
    let changes: string[] = []

    function App(handle: Handle) {
      let value = 'overview'

      return () => (
        <Tabs
          value={value}
          onValueChange={(nextValue) => {
            changes.push(nextValue)
            value = nextValue
            handle.update()
          }}
        >
          <TabsList aria-label="Project sections">
            <Tab value="overview">Overview</Tab>
            <Tab value="reports">Reports</Tab>
          </TabsList>
          <TabsPanel value="overview">Overview panel</TabsPanel>
          <TabsPanel value="reports">Reports panel</TabsPanel>
        </Tabs>
      )
    }

    let { container, root } = renderApp(<App />)
    let reports = getTabByText(container, 'Reports')

    activate(reports)
    root.flush()

    expect(changes).toEqual(['reports'])
    expect(reports.getAttribute('aria-selected')).toBe('true')
    expect(getPanelByText(container, 'Reports panel').hidden).toBe(false)
  })

  it('supports wraparound keyboard navigation and skips disabled tabs', () => {
    let { container, root } = renderApp(renderExampleTabs({ defaultValue: 'overview' }))

    let overview = getTabByText(container, 'Overview')
    let reports = getTabByText(container, 'Reports')
    let settings = getTabByText(container, 'Settings')

    overview.focus()

    key(overview, 'ArrowRight')
    root.flush()

    expect(document.activeElement).toBe(reports)
    expect(reports.getAttribute('aria-selected')).toBe('true')

    key(reports, 'End')
    root.flush()

    expect(document.activeElement).toBe(settings)
    expect(settings.getAttribute('aria-selected')).toBe('true')

    key(settings, 'ArrowRight')
    root.flush()

    expect(document.activeElement).toBe(overview)
    expect(overview.getAttribute('aria-selected')).toBe('true')

    key(overview, 'Home')
    root.flush()

    expect(document.activeElement).toBe(overview)
  })

  it('supports vertical keyboard navigation', () => {
    let { container, root } = renderApp(
      renderExampleTabs({
        defaultValue: 'reports',
        orientation: 'vertical',
      }),
    )

    let overview = getTabByText(container, 'Overview')
    let reports = getTabByText(container, 'Reports')

    reports.focus()

    key(reports, 'ArrowUp')
    root.flush()

    expect(document.activeElement).toBe(overview)
    expect(overview.getAttribute('aria-selected')).toBe('true')

    key(overview, 'ArrowDown')
    root.flush()

    expect(document.activeElement).toBe(reports)
    expect(reports.getAttribute('aria-selected')).toBe('true')
  })

  it('supports lower-level composition and dispatches a bubbling change event', () => {
    let captured: TabsChangeEvent | null = null

    let { container, root } = renderApp(
      <div
        mix={onTabsChange((event) => {
          captured = event as TabsChangeEvent
        })}
      >
        <tabs.Context defaultValue="overview">
          <div mix={tabs.list()} aria-label="Project sections">
            <button type="button" mix={tabs.trigger({ value: 'overview' })}>
              Overview
            </button>
            <button type="button" mix={tabs.trigger({ value: 'reports' })}>
              Reports
            </button>
          </div>

          <section mix={tabs.panel({ value: 'overview' })}>Overview panel</section>
          <section mix={tabs.panel({ value: 'reports' })}>Reports panel</section>
        </tabs.Context>
      </div>,
    )

    let reports = getTabByText(container, 'Reports')

    activate(reports)
    root.flush()

    let changeEvent = captured as TabsChangeEvent | null

    expect(captured).toBeInstanceOf(TabsChangeEvent)
    expect(changeEvent?.previousValue).toBe('overview')
    expect(changeEvent?.value).toBe('reports')
    expect(reports.getAttribute('aria-selected')).toBe('true')
    expect(getPanelByText(container, 'Reports panel').hidden).toBe(false)
  })

  it('keeps inactive panels hidden even when app panel styles set display', async () => {
    let panelCss = css({
      display: 'flex',
    })

    let html = await renderToString(
      <Tabs defaultValue="overview">
        <TabsList aria-label="Project sections">
          <Tab value="overview">Overview</Tab>
          <Tab value="reports">Reports</Tab>
        </TabsList>

        <TabsPanel mix={panelCss} value="overview">
          Overview panel
        </TabsPanel>
        <TabsPanel mix={panelCss} value="reports">
          Reports panel
        </TabsPanel>
      </Tabs>,
    )

    expect(html).toMatch(/display: flex;/)
    expect(html).toMatch(/\[hidden\][^{]*\{\s*display:\s*none;/)
  })
})
