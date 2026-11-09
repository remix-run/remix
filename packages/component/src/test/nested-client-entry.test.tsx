import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { createMixin, on } from '../index.ts'
import { clientEntry, type EntryComponent } from '../runtime/client-entries.ts'
import type { Handle, RemixNode } from '../runtime/component.ts'
import { invariant } from '../runtime/invariant.ts'
import { run } from '../runtime/run.ts'
import { renderToStream } from '../server/stream.ts'
import { drain } from './utils.ts'

async function expectSingleClick(renderContent: (Inner: EntryComponent) => RemixNode) {
  let clicks = 0
  let updateOuter = () => {}
  let Inner = clientEntry('/inner.js#Inner', function Inner() {
    return () => (
      <button
        mix={[
          on('click', () => {
            clicks++
          }),
        ]}
      >
        Inner
      </button>
    )
  })
  let Outer = clientEntry('/outer.js#Outer', function Outer(handle: Handle) {
    updateOuter = () => {
      void handle.update()
    }
    return () => renderContent(Inner)
  })

  document.body.innerHTML = await drain(renderToStream(<Outer />))
  let app = run({
    loadModule(moduleUrl, exportName) {
      if (moduleUrl === '/outer.js' && exportName === 'Outer') return Outer
      if (moduleUrl === '/inner.js' && exportName === 'Inner') return Inner
      throw new Error(`Unexpected client entry: ${moduleUrl}#${exportName}`)
    },
  })

  try {
    await app.ready()
    let button = document.querySelector('button')
    invariant(button)
    button.click()
    let initialClicks = clicks

    updateOuter()
    app.flush()
    expect(document.querySelector('button')).toBe(button)
    button.click()
    expect([initialClicks, clicks]).toEqual([1, 2])
  } finally {
    app.dispose()
  }
}

async function expectDeferredRemoval(nestedEntry: boolean) {
  let removal = Promise.withResolvers<void>()
  let beforeRemoveCalls = 0
  let removeCalls = 0
  let hideInner = () => {}
  let withDeferredRemove = createMixin((handle) => {
    handle.addEventListener('beforeRemove', (event) => {
      beforeRemoveCalls++
      event.persistNode(() => removal.promise)
    })
    handle.addEventListener('remove', () => {
      removeCalls++
    })
    return () => {}
  })

  function Content() {
    return () => (
      <div id="deferred-remove" key="inner" mix={[withDeferredRemove()]}>
        Inner
      </div>
    )
  }
  let Inner = nestedEntry ? clientEntry('/inner.js#Inner', Content) : Content
  let Outer = clientEntry('/outer.js#Outer', function Outer(handle: Handle) {
    let visible = true
    hideInner = () => {
      visible = false
      void handle.update()
    }
    return () => <section>{visible ? <Inner /> : null}</section>
  })

  document.body.innerHTML = await drain(renderToStream(<Outer />))
  beforeRemoveCalls = 0
  removeCalls = 0
  let app = run({
    loadModule(moduleUrl, exportName) {
      if (moduleUrl === '/outer.js' && exportName === 'Outer') return Outer
      if (moduleUrl === '/inner.js' && exportName === 'Inner') return Inner
      throw new Error(`Unexpected client entry: ${moduleUrl}#${exportName}`)
    },
  })

  try {
    await app.ready()
    let element = document.getElementById('deferred-remove')
    invariant(element)

    hideInner()
    app.flush()
    await Promise.resolve()
    let pendingRemoval = {
      beforeRemoveCalls,
      removeCalls,
      retained: document.getElementById('deferred-remove') === element,
    }

    removal.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(pendingRemoval).toEqual({ beforeRemoveCalls: 1, removeCalls: 0, retained: true })
    expect(removeCalls).toBe(1)
    expect(document.getElementById('deferred-remove')).toBe(null)
  } finally {
    removal.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    app.dispose()
  }
}

describe('nested client entry regressions', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  })

  it('attaches one listener when an imported entry is directly inside a host element', async () => {
    await expectSingleClick((Inner) => (
      <section>
        <Inner />
      </section>
    ))
  })

  it('attaches one listener when an imported entry is returned directly', async () => {
    await expectSingleClick((Inner) => <Inner />)
  })

  it('attaches one listener when an imported entry is inside a fragment', async () => {
    await expectSingleClick((Inner) => (
      <section>
        <>
          <Inner />
        </>
      </section>
    ))
  })

  it('attaches one listener when an imported entry is inside a wrapper component', async () => {
    function Wrapper(handle: Handle<{ children: RemixNode }>) {
      return () => handle.props.children
    }
    await expectSingleClick((Inner) => (
      <section>
        <Wrapper>
          <Inner />
        </Wrapper>
      </section>
    ))
  })

  it('hydrates a client entry passed as a prop to another client entry', async () => {
    let clicks = 0
    let outerSetups = 0
    let innerSetups = 0
    let updateOuterHandle: Handle<{ children: RemixNode }> | undefined
    let Inner = clientEntry('/inner.js#Inner', function Inner() {
      innerSetups++
      return () => (
        <button
          mix={[
            on('click', () => {
              clicks++
            }),
          ]}
        >
          Inner
        </button>
      )
    })
    let Outer = clientEntry(
      '/outer.js#Outer',
      function Outer(handle: Handle<{ children: RemixNode }>) {
        outerSetups++
        updateOuterHandle = handle
        return () => <section>{handle.props.children}</section>
      },
    )

    let html = await drain(
      renderToStream(
        <Outer>
          <Inner />
        </Outer>,
      ),
    )
    let serverOuterSetups = outerSetups
    let serverInnerSetups = innerSetups
    document.body.innerHTML = html
    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/outer.js' && exportName === 'Outer') return Outer
        if (moduleUrl === '/inner.js' && exportName === 'Inner') return Inner
        throw new Error(`Unexpected client entry: ${moduleUrl}#${exportName}`)
      },
    })

    try {
      await app.ready()
      expect(serverInnerSetups).toBe(1)
      expect(serverOuterSetups).toBe(1)

      let button = document.querySelector('button')
      invariant(button)
      button.click()
      expect(clicks).toBe(1)

      invariant(updateOuterHandle)
      void updateOuterHandle.update()
      app.flush()

      expect(document.querySelector('button')).toBe(button)
      button.click()
      expect(clicks).toBe(2)
    } finally {
      app.dispose()
    }
  })

  it('supports stateful client entry passed as a prop with props and internal updates', async () => {
    let innerUpdates = 0
    let Inner = clientEntry(
      '/toggle.js#Toggle',
      function Toggle(handle: Handle<{ initialText: string }>) {
        let text = handle.props.initialText
        return () => (
          <button
            mix={[
              on('click', () => {
                text = 'Toggled'
                innerUpdates++
                void handle.update()
              }),
            ]}
          >
            {text}
          </button>
        )
      },
    )
    let Outer = clientEntry(
      '/outer.js#Outer',
      function Outer(handle: Handle<{ children: RemixNode }>) {
        return () => <section>{handle.props.children}</section>
      },
    )

    let html = await drain(
      renderToStream(
        <Outer>
          <Inner initialText="Initial" />
        </Outer>,
      ),
    )
    document.body.innerHTML = html
    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/outer.js' && exportName === 'Outer') return Outer
        if (moduleUrl === '/toggle.js' && exportName === 'Toggle') return Inner
        throw new Error(`Unexpected client entry: ${moduleUrl}#${exportName}`)
      },
    })

    try {
      await app.ready()
      let button = document.querySelector('button')
      invariant(button)
      expect(button.textContent).toBe('Initial')

      button.click()
      app.flush()
      expect(button.textContent).toBe('Toggled')
      expect(innerUpdates).toBe(1)
    } finally {
      app.dispose()
    }
  })

  it('defers removal of an ordinary child component until persistence finishes', async () => {
    await expectDeferredRemoval(false)
  })

  it('defers removal of an imported client entry until persistence finishes', async () => {
    await expectDeferredRemoval(true)
  })
})
