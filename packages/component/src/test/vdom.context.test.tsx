import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import type { Handle, RemixNode } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('context', () => {
    it('provides and reads context', () => {
      let container = document.createElement('div')

      function App(handle: Handle<{ value: string }>) {
        handle.context.set({ value: 'test' })
        return ({ children }: { children: RemixNode }) => <div>{children}</div>
      }

      function Child(handle: Handle) {
        let { value } = handle.context.get(App)
        return () => <main>Child: {value}</main>
      }

      let root = createRoot(container)
      root.render(
        <App>
          <Child />
        </App>,
      )
      expect(container.innerHTML).toContain('Child: test')
    })

    it('provides context on updates', () => {
      let container = document.createElement('div')

      let capturedUpdate = () => {}
      function App(handle: Handle<{ value: string }>) {
        handle.context.set({ value: 'test' })
        capturedUpdate = () => {
          handle.context.set({ value: 'test2' })
          handle.update()
        }
        return ({ children }: { children: RemixNode }) => <div>{children}</div>
      }

      function Child(handle: Handle) {
        return () => {
          let { value } = handle.context.get(App)
          return <main>Child: {value}</main>
        }
      }

      let root = createRoot(container)
      root.render(
        <App>
          <Child />
        </App>,
      )
      expect(container.innerHTML).toContain('Child: test')

      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toContain('Child: test2')
    })

    it('renders descendants in order of appearance', () => {
      let container = document.createElement('div')

      let options: string[] = []
      let renderListbox = () => {}

      function Listbox(handle: Handle<{ registerOption: (option: string) => void }>) {
        handle.context.set({
          registerOption: (option: string) => {
            options.push(option)
          },
        })

        renderListbox = handle.update

        return ({ children }: { children: RemixNode }) => {
          options = []
          return <div>{children}</div>
        }
      }

      function Option(handle: Handle) {
        let { registerOption } = handle.context.get(Listbox)
        return ({ value }: { value: string }) => {
          registerOption(value)
          return <div>Option</div>
        }
      }

      function App(handle: Handle) {
        return () => (
          <Listbox>
            <Option value="Option 1" />
            <Option value="Option 2" />
            <Option value="Option 3" />
          </Listbox>
        )
      }

      let root = createRoot(container)

      root.render(<App />)
      expect(options).toEqual(['Option 1', 'Option 2', 'Option 3'])

      renderListbox()
      root.flush()
      expect(options).toEqual(['Option 1', 'Option 2', 'Option 3'])
    })
  })
})
