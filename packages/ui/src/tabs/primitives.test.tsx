import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, type Handle, type RemixNode } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'

import * as tabs from './primitives.ts'
import { TabsChangeEvent, onTabsChange, type TabsContextProps } from './primitives.ts'

let roots: ReturnType<typeof createRoot>[] = []

function TestTabs(handle: Handle<TabsContextProps>) {
  return () => {
    let { children, ...contextProps } = handle.props

    return (
      <tabs.Context {...contextProps}>
        <div mix={tabs.root()}>{children}</div>
      </tabs.Context>
    )
  }
}

function TestTabList(handle: Handle<{ children?: RemixNode }>) {
  return () => {
    let { children } = handle.props

    return <div mix={tabs.list()}>{children}</div>
  }
}

function TestTab(handle: Handle<{ children?: RemixNode; disabled?: boolean; name: string }>) {
  return () => {
    let { children, disabled, name } = handle.props

    return (
      <button mix={tabs.tab({ disabled, name })} type="button">
        {children}
      </button>
    )
  }
}

function TestTabPanel(handle: Handle<{ children?: RemixNode; name: string }>) {
  return () => {
    let { children, name } = handle.props

    return <div mix={tabs.panel({ name })}>{children}</div>
  }
}

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

function renderExampleTabs(props: TabsContextProps = {}) {
  return (
    <TestTabs {...props}>
      <TestTabList>
        <TestTab name="overview">Overview</TestTab>
        <TestTab name="activity">Activity</TestTab>
        <TestTab disabled name="settings">
          Settings
        </TestTab>
      </TestTabList>
      <TestTabPanel name="overview">Project summary.</TestTabPanel>
      <TestTabPanel name="activity">Recent changes.</TestTabPanel>
      <TestTabPanel name="settings">Private controls.</TestTabPanel>
    </TestTabs>
  )
}

function getTabs(container: HTMLElement) {
  return [...container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[]
}

function getPanels(container: HTMLElement) {
  return [...container.querySelectorAll('[role="tabpanel"]')] as HTMLDivElement[]
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('tabs', () => {
  it('supports uncontrolled mode with a default active tab', () => {
    let changes: string[] = []
    let { container, root } = renderApp(
      renderExampleTabs({
        defaultActiveTab: 'activity',
        onActiveTabChange(activeTab) {
          changes.push(activeTab)
        },
      }),
    )
    let tabButtons = getTabs(container)
    let panels = getPanels(container)

    expect(tabButtons[0].getAttribute('aria-selected')).toBe('false')
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('true')
    expect(tabButtons[1].getAttribute('data-state')).toBe('active')
    expect(panels[0].hidden).toBe(true)
    expect(panels[1].hidden).toBe(false)

    tabButtons[0].click()
    root.flush()
    tabButtons = getTabs(container)
    panels = getPanels(container)

    expect(changes).toEqual(['overview'])
    expect(tabButtons[0].getAttribute('aria-selected')).toBe('true')
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('false')
    expect(panels[0].hidden).toBe(false)
    expect(panels[1].hidden).toBe(true)
  })

  it('uses the first enabled tab when no default active tab is provided', () => {
    let { container } = renderApp(
      <TestTabs>
        <TestTabList>
          <TestTab disabled name="disabled">
            Disabled
          </TestTab>
          <TestTab name="first-enabled">First enabled</TestTab>
        </TestTabList>
        <TestTabPanel name="disabled">Disabled content.</TestTabPanel>
        <TestTabPanel name="first-enabled">Enabled content.</TestTabPanel>
      </TestTabs>,
    )
    let tabButtons = getTabs(container)
    let panels = getPanels(container)

    expect(tabButtons[0].getAttribute('aria-selected')).toBe('false')
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('true')
    expect(panels[0].hidden).toBe(true)
    expect(panels[1].hidden).toBe(false)
  })

  it('renders the first enabled tab active on the server', async () => {
    let html = await renderToString(
      <TestTabs>
        <TestTabList>
          <TestTab disabled name="disabled">
            Disabled
          </TestTab>
          <TestTab name="first-enabled">First enabled</TestTab>
        </TestTabList>
        <TestTabPanel name="disabled">Disabled content.</TestTabPanel>
        <TestTabPanel name="first-enabled">Enabled content.</TestTabPanel>
      </TestTabs>,
    )
    let serverDocument = new DOMParser().parseFromString(html, 'text/html')
    let tabButtons = getTabs(serverDocument.body)
    let panels = getPanels(serverDocument.body)

    expect(tabButtons[0].getAttribute('aria-selected')).toBe('false')
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('true')
    expect(tabButtons[1].getAttribute('data-state')).toBe('active')
    expect(panels[0].hidden).toBe(true)
    expect(panels[1].hidden).toBe(false)
  })

  it('supports controlled mode', () => {
    let changes: string[] = []

    function App(handle: Handle) {
      let activeTab = 'overview'

      return () => (
        <TestTabs
          activeTab={activeTab}
          onActiveTabChange={(nextActiveTab) => {
            changes.push(nextActiveTab)
            activeTab = nextActiveTab
            void handle.update()
          }}
        >
          <TestTabList>
            <TestTab name="overview">Overview</TestTab>
            <TestTab name="activity">Activity</TestTab>
          </TestTabList>
          <TestTabPanel name="overview">Project summary.</TestTabPanel>
          <TestTabPanel name="activity">Recent changes.</TestTabPanel>
        </TestTabs>
      )
    }

    let { container, root } = renderApp(<App />)
    let tabButtons = getTabs(container)

    tabButtons[1].click()
    root.flush()
    tabButtons = getTabs(container)

    expect(changes).toEqual(['activity'])
    expect(tabButtons[0].getAttribute('aria-selected')).toBe('false')
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('true')
  })

  it('dispatches a bubbling Tabs change event from the root', () => {
    let captured: TabsChangeEvent | null = null
    let { container, root } = renderApp(
      <div
        mix={onTabsChange((event) => {
          captured = event as TabsChangeEvent
        })}
      >
        {renderExampleTabs({ defaultActiveTab: 'overview' })}
      </div>,
    )
    let tabButtons = getTabs(container)

    tabButtons[1].click()
    root.flush()

    expect(captured).toBeInstanceOf(TabsChangeEvent)
    expect((captured as TabsChangeEvent | null)?.activeTab).toBe('activity')
    expect((captured as TabsChangeEvent | null)?.previousActiveTab).toBe('overview')
  })

  it('uses arrow keys to activate tabs', () => {
    let { container, root } = renderApp(renderExampleTabs({ defaultActiveTab: 'overview' }))
    let tabButtons = getTabs(container)
    let panels = getPanels(container)

    tabButtons[0].focus()
    tabButtons[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
    root.flush()
    tabButtons = getTabs(container)
    panels = getPanels(container)

    expect(document.activeElement).toBe(tabButtons[1])
    expect(tabButtons[0].getAttribute('aria-selected')).toBe('false')
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('true')
    expect(panels[0].hidden).toBe(true)
    expect(panels[1].hidden).toBe(false)

    tabButtons[1].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
    root.flush()
    tabButtons = getTabs(container)

    expect(document.activeElement).toBe(tabButtons[0])
    expect(tabButtons[0].getAttribute('aria-selected')).toBe('true')
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('false')
  })

  it('uses Home and End to activate the first and last enabled tabs', () => {
    let { container, root } = renderApp(renderExampleTabs({ defaultActiveTab: 'overview' }))
    let tabButtons = getTabs(container)

    tabButtons[0].focus()
    tabButtons[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End' }))
    root.flush()
    tabButtons = getTabs(container)

    expect(document.activeElement).toBe(tabButtons[1])
    expect(tabButtons[0].getAttribute('aria-selected')).toBe('false')
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('true')

    tabButtons[1].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Home' }))
    root.flush()
    tabButtons = getTabs(container)

    expect(document.activeElement).toBe(tabButtons[0])
    expect(tabButtons[0].getAttribute('aria-selected')).toBe('true')
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('false')
  })

  it('supports Enter and Space activation', () => {
    let { container, root } = renderApp(renderExampleTabs({ defaultActiveTab: 'overview' }))
    let tabButtons = getTabs(container)

    tabButtons[1].focus()
    tabButtons[1].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    root.flush()
    tabButtons = getTabs(container)

    expect(tabButtons[1].getAttribute('aria-selected')).toBe('true')

    tabButtons[0].focus()
    tabButtons[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }))
    root.flush()
    tabButtons = getTabs(container)

    expect(tabButtons[0].getAttribute('aria-selected')).toBe('true')
  })

  it('does not activate disabled tabs', () => {
    let changes: string[] = []
    let { container, root } = renderApp(
      renderExampleTabs({
        defaultActiveTab: 'overview',
        onActiveTabChange(activeTab) {
          changes.push(activeTab)
        },
      }),
    )
    let tabButtons = getTabs(container)

    tabButtons[2].click()
    root.flush()

    expect(changes).toEqual([])
    expect(tabButtons[0].getAttribute('aria-selected')).toBe('true')
    expect(tabButtons[2].disabled).toBe(true)
  })
})
