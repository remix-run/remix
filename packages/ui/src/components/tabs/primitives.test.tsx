import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, css, type Handle, type RemixNode } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'

import { onTabsChange, TabsChangeEvent, type TabsProps } from './primitives.tsx'
import * as tabs from './primitives.tsx'

let roots: ReturnType<typeof createRoot>[] = []

function TestTabs(handle: Handle<TabsProps>) {
  return () => {
    let { children, ...contextProps } = handle.props
    return <tabs.Context {...contextProps}>{children}</tabs.Context>
  }
}

function TestTabsList(handle: Handle<tabs.TabsListProps>) {
  return () => {
    let { children, mix, ...divProps } = handle.props

    return (
      <div {...divProps} mix={[tabs.list(), mix]}>
        {children}
      </div>
    )
  }
}

function TestTab(handle: Handle<tabs.TabProps>) {
  return () => {
    let { children, disabled, mix, type, value, ...buttonProps } = handle.props

    return (
      <button
        {...buttonProps}
        disabled={disabled ? true : undefined}
        mix={[tabs.trigger({ disabled, value }), mix]}
        type={type ?? 'button'}
      >
        {children}
      </button>
    )
  }
}

function TestTabsPanel(handle: Handle<tabs.TabsPanelProps>) {
  return () => {
    let { children, mix, value, ...divProps } = handle.props

    return (
      <div {...divProps} mix={[tabs.panel({ value }), mix]}>
        {children}
      </div>
    )
  }
}

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
    <TestTabs {...props}>
      <TestTabsList aria-label="Project sections">
        <TestTab value="overview">Overview</TestTab>
        <TestTab disabled value="analytics">
          Analytics
        </TestTab>
        <TestTab value="reports">Reports</TestTab>
        <TestTab value="settings">Settings</TestTab>
      </TestTabsList>

      <TestTabsPanel value="overview">Overview panel</TestTabsPanel>
      <TestTabsPanel value="analytics">Analytics panel</TestTabsPanel>
      <TestTabsPanel value="reports">Reports panel</TestTabsPanel>
      <TestTabsPanel value="settings">Settings panel</TestTabsPanel>
    </TestTabs>
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
        <TestTabs
          value={value}
          onValueChange={(nextValue) => {
            changes.push(nextValue)
            value = nextValue
            handle.update()
          }}
        >
          <TestTabsList aria-label="Project sections">
            <TestTab value="overview">Overview</TestTab>
            <TestTab value="reports">Reports</TestTab>
          </TestTabsList>
          <TestTabsPanel value="overview">Overview panel</TestTabsPanel>
          <TestTabsPanel value="reports">Reports panel</TestTabsPanel>
        </TestTabs>
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

  it('marks inactive panels as hidden', async () => {
    let panelCss = css({
      display: 'flex',
    })

    let html = await renderToString(
      <TestTabs defaultValue="overview">
        <TestTabsList aria-label="Project sections">
          <TestTab value="overview">Overview</TestTab>
          <TestTab value="reports">Reports</TestTab>
        </TestTabsList>

        <TestTabsPanel mix={panelCss} value="overview">
          Overview panel
        </TestTabsPanel>
        <TestTabsPanel mix={panelCss} value="reports">
          Reports panel
        </TestTabsPanel>
      </TestTabs>,
    )

    expect(html).toMatch(/display: flex;/)
    expect(html).toMatch(/role="tabpanel" hidden/)
  })
})
