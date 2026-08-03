import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, type RemixNode } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'
import { onTabsChange } from '@remix-run/ui/tabs/primitives'

import {
  listStyle,
  panelStyle,
  rootStyle,
  tabStyle,
  Tab,
  Tabs,
  TabList,
  TabPanel,
  type TabsProps,
} from './index.tsx'

let roots: ReturnType<typeof createRoot>[] = []

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

function renderExampleTabs(props: TabsProps = {}) {
  return (
    <Tabs {...props}>
      <TabList aria-label="Project sections">
        <Tab name="overview">Overview</Tab>
        <Tab name="activity">Activity</Tab>
        <Tab disabled name="settings">
          Settings
        </Tab>
      </TabList>
      <TabPanel name="overview">Project summary.</TabPanel>
      <TabPanel name="activity">Recent changes.</TabPanel>
      <TabPanel name="settings">Private controls.</TabPanel>
    </Tabs>
  )
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('Tabs', () => {
  it('renders styled tabs wrappers with ui primitive roles', () => {
    let { container } = renderApp(renderExampleTabs({ defaultActiveTab: 'activity' }))
    let list = container.querySelector('[role="tablist"]') as HTMLDivElement
    let tabButtons = [...container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[]
    let panels = [...container.querySelectorAll('[role="tabpanel"]')] as HTMLDivElement[]

    expect(list.getAttribute('aria-label')).toBe('Project sections')
    expect(tabButtons).toHaveLength(3)
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('true')
    expect(tabButtons[1].getAttribute('aria-controls')).toBe(panels[1].id)
    expect(panels[1].getAttribute('aria-labelledby')).toBe(tabButtons[1].id)
    expect(container.querySelector('[data-rmx-tabs-indicator]')).toBe(null)
  })

  it('updates active tab state without indicator markup', () => {
    let { container, root } = renderApp(renderExampleTabs({ defaultActiveTab: 'overview' }))
    root.flush()
    let tabButtons = [...container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[]

    expect(tabButtons[0].getAttribute('data-state')).toBe('active')
    expect(tabButtons[1].getAttribute('data-state')).toBe('inactive')
    expect(container.querySelector('[data-rmx-tabs-indicator]')).toBe(null)

    tabButtons[1].click()
    root.flush()
    tabButtons = [...container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[]

    expect(tabButtons[0].getAttribute('data-state')).toBe('inactive')
    expect(tabButtons[1].getAttribute('data-state')).toBe('active')
    expect(container.querySelector('[data-rmx-tabs-indicator]')).toBe(null)
  })

  it('composes tabs change events', () => {
    let values: string[] = []
    let { container, root } = renderApp(
      <div
        mix={onTabsChange((event) => {
          values.push(event.activeTab)
        })}
      >
        {renderExampleTabs({ defaultActiveTab: 'overview' })}
      </div>,
    )
    let tabButtons = [...container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[]

    tabButtons[1].click()
    root.flush()

    expect(values).toEqual(['activity'])
  })
})

describe('tabs style exports', () => {
  it('serializes tabs mixins with a track and toggle-slider active tab styles', async () => {
    let html = await renderToString(
      <div mix={rootStyle}>
        <div mix={listStyle}>
          <button data-state="active" mix={tabStyle} type="button">
            Overview
          </button>
          <button data-state="inactive" mix={tabStyle} type="button">
            Activity
          </button>
        </div>
        <div mix={panelStyle}>Project summary.</div>
      </div>,
    )

    expect(html).toContain('--rmx-tabs-height: 32px')
    expect(html).toContain('--rmx-tabs-track-padding: 2px')
    expect(html).toContain('--rmx-tabs-tab-font-size: 12px')
    expect(html).toContain('--rmx-tabs-tab-line-height: 17px')
    expect(html).toContain('min-height: var(--rmx-tabs-height)')
    expect(html).toContain('display: inline-flex')
    expect(html).toContain('gap: 2px')
    expect(html).toContain(
      'background: linear-gradient(180deg, light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08))',
    )
    expect(html).toContain('inset 0 0 4px 1px rgba(0, 0, 0, 0.08)')
    expect(html).toContain(
      'height: calc(var(--rmx-tabs-height) - (var(--rmx-tabs-track-padding) * 2))',
    )
    expect(html).toContain('font-size: var(--rmx-tabs-tab-font-size)')
    expect(html).toContain('line-height: var(--rmx-tabs-tab-line-height)')
    expect(html).toContain(
      'background: linear-gradient(180deg, rgba(0, 0, 0, 0) 33%, light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.08)) 100%), light-dark(#FFFFFF, #1a1a1a)',
    )
    expect(html).toContain(
      '0 0 0 0.5px light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.12))',
    )
    expect(html).toContain('0 4px 4px -2px rgba(0, 0, 0, 0.12)')
    expect(html).toContain('0 0 0 1px light-dark(#3573F6, #6eaaff)')
    expect(html).toContain('&[data-state="active"]')
    expect(html).not.toContain('data-rmx-tabs-indicator')
  })

  it('supports large sizing through the root component', async () => {
    let html = await renderToString(renderExampleTabs({ defaultActiveTab: 'overview', size: 'lg' }))

    expect(html).toContain('--rmx-tabs-height: 36px')
    expect(html).toContain('--rmx-tabs-tab-padding-inline: 14px')
    expect(html).toContain('--rmx-tabs-tab-font-size: 13px')
    expect(html).toContain('--rmx-tabs-tab-line-height: 20px')
  })
})
