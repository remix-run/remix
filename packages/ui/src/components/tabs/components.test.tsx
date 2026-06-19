import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, type RemixNode } from '@remix-run/ui'
import { onTabsChange } from '@remix-run/ui/tabs'

import { Tab, Tabs, TabsList, TabsPanel } from './components.tsx'

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
    let { container } = renderApp(
      <Tabs defaultValue="overview">
        <TabsList aria-label="Project sections">
          <Tab value="overview">Overview</Tab>
          <Tab disabled value="reports">
            Reports
          </Tab>
        </TabsList>
        <TabsPanel value="overview">Overview panel</TabsPanel>
        <TabsPanel value="reports">Reports panel</TabsPanel>
      </Tabs>,
    )

    let list = container.querySelector('[role="tablist"]') as HTMLElement
    let overview = container.querySelector('[role="tab"]') as HTMLButtonElement
    let panels = container.querySelectorAll('[role="tabpanel"]')

    expect(list.getAttribute('aria-label')).toBe('Project sections')
    expect(overview.getAttribute('aria-selected')).toBe('true')
    expect(panels).toHaveLength(2)
  })

  it('composes ui tabs events', () => {
    let values: string[] = []
    let { container, root } = renderApp(
      <div
        mix={onTabsChange((event) => {
          values.push(event.value)
        })}
      >
        <Tabs defaultValue="overview">
          <TabsList aria-label="Project sections">
            <Tab value="overview">Overview</Tab>
            <Tab value="reports">Reports</Tab>
          </TabsList>
          <TabsPanel value="overview">Overview panel</TabsPanel>
          <TabsPanel value="reports">Reports panel</TabsPanel>
        </Tabs>
      </div>,
    )

    let reports = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (tab) => tab.textContent?.trim() === 'Reports',
    ) as HTMLButtonElement

    reports.click()
    root.flush()

    expect(values).toEqual(['reports'])
  })
})
