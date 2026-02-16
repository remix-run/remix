import { createReconciler } from '@remix-run/reconciler'
import { describe, expect, it } from 'vitest'
import type { UpdateHandle } from '@remix-run/reconciler'

import { createDomNodePolicy } from './dom-node-policy.ts'
import { createDomPlugins } from './dom-plugins.ts'

describe('dom reconciler integration', () => {
  it('keeps sibling host boundaries for dashboard-style component trees', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    function Header() {
      return ({ label }: { label: string }) => (
        <div>
          <h1>{label}</h1>
          <button>Switch to Table</button>
        </div>
      )
    }

    function Dashboard() {
      return ({ title }: { title: string }) => (
        <main>
          <Header label={title} />
          <div>
            <section>a</section>
            <section>b</section>
          </div>
        </main>
      )
    }

    root.render(<Dashboard title="Dashboard" />)
    root.flush()

    expect(container.innerHTML).toBe(
      '<main><div><h1>Dashboard</h1><button>Switch to Table</button></div><div><section>a</section><section>b</section></div></main>',
    )
  })

  it('preserves sibling shape across handle-driven updates', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)
    let switchCard = () => {}

    function Header() {
      return ({ onSwitch }: { onSwitch: () => void }) => (
        <div>
          <h1>Dashboard</h1>
          <button on={{ click: onSwitch }}>Switch to Table</button>
        </div>
      )
    }

    function App(handle: UpdateHandle) {
      let step = 0
      switchCard = () => {
        step++
        handle.update()
      }

      return () => (
        <main>
          <Header onSwitch={switchCard!} />
          <div>{step === 0 ? <section>a</section> : <section>b</section>}</div>
        </main>
      )
    }

    root.render(<App />)
    root.flush()
    expect(container.innerHTML).toBe(
      '<main><div><h1>Dashboard</h1><button>Switch to Table</button></div><div><section>a</section></div></main>',
    )

    if (!switchCard) throw new Error('expected switch callback')
    switchCard()
    root.flush()
    expect(container.innerHTML).toBe(
      '<main><div><h1>Dashboard</h1><button>Switch to Table</button></div><div><section>b</section></div></main>',
    )
  })

  it('does not reuse host nodes across host-to-component swaps', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    function Dashboard() {
      return () => (
        <div id="dashboard">
          <h1>Dashboard</h1>
        </div>
      )
    }

    root.render(
      <div id="table">
        <table>
          <tbody />
        </table>
      </div>,
    )
    root.flush()
    let first = container.firstElementChild
    if (!first) throw new Error('expected first element')

    root.render(<Dashboard />)
    root.flush()
    let second = container.firstElementChild
    if (!second) throw new Error('expected second element')

    expect(second).not.toBe(first)
    expect(container.innerHTML).toBe('<div id="dashboard"><h1>Dashboard</h1></div>')
  })

  it('keeps dashboard sibling layout when switching from table host view', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)
    let switchToDashboard = () => {}

    function Dashboard() {
      return () => (
        <div class="container">
          <div>
            <h1>Dashboard</h1>
            <button>Switch to Table</button>
          </div>
          <div>
            <section>a</section>
            <section>b</section>
          </div>
        </div>
      )
    }

    function App(handle: UpdateHandle) {
      let view: 'table' | 'dashboard' = 'table'
      switchToDashboard = () => {
        view = 'dashboard'
        handle.update()
      }

      return () => {
        if (view === 'dashboard') return <Dashboard />
        return (
          <div class="container">
            <div class="jumbotron">
              <h1>Table</h1>
            </div>
            <table>
              <tbody />
            </table>
          </div>
        )
      }
    }

    root.render(<App />)
    root.flush()
    expect(container.innerHTML).toBe(
      '<div class="container"><div class="jumbotron"><h1>Table</h1></div><table><tbody></tbody></table></div>',
    )

    switchToDashboard()
    root.flush()
    expect(container.innerHTML).toBe(
      '<div class="container"><div><h1>Dashboard</h1><button>Switch to Table</button></div><div><section>a</section><section>b</section></div></div>',
    )
  })

  it('updates middle keyed subtree from nested component handle', async () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)
    let activateNested = () => {}

    function Nested(handle: UpdateHandle) {
      let active = false
      activateNested = () => {
        active = true
        handle.update()
      }
      return () => <span>{active ? 'next:2' : '2'}</span>
    }

    function App() {
      return () => (
        <div>
          <Nested key="a" />
        </div>
      )
    }

    root.render(<App />)
    root.flush()
    expect(container.innerHTML).toBe('<div><span>2</span></div>')
    activateNested()
    root.flush()
    await Promise.resolve()

    expect(container.innerHTML).toBe('<div><span>next:2</span></div>')
  })
})

function createDomRoot(container: HTMLElement) {
  let reconciler = createReconciler(createDomNodePolicy(document), createDomPlugins())
  return reconciler.createRoot(container)
}
