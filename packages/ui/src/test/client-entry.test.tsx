import { describe, it, expect } from 'vitest'
import type { Handle } from '../runtime/component.ts'
import { clientEntry, isEntry } from '../runtime/client-entries.ts'

describe('clientEntry', () => {
  /* oxlint-disable eslint/no-unused-vars */
  describe('types', () => {
    it('keeps original types', () => {
      function Input(handle: Handle<{ defaultValue?: string; label: string }>) {
        let value = handle.props.defaultValue ?? ''
        return () => (
          <label>
            {handle.props.label}: <input type="text" value={value} />
          </label>
        )
      }

      let HydratedInput = clientEntry('/js/test.js#Input', Input)

      // @ts-expect-error - should require label prop
      let el = <Input />
      // @ts-expect-error - should require label prop
      let el2 = <HydratedInput />

      expect(true).toBe(true)
    })

    it('only allows serializable props', () => {
      function Input(handle: Handle<{ defaultValue?: string; func: () => void; label: string }>) {
        let value = handle.props.defaultValue ?? ''
        return () => (
          <label>
            {handle.props.label}: <input type="text" value={value} />
          </label>
        )
      }

      // @ts-expect-error - should disallow non-serializable function prop
      let HydratedInput = clientEntry('/js/test.js#Input', Input)

      expect(true).toBe(true)
    })
  })

  describe('basic functionality', () => {
    it('marks a component as an entry', () => {
      function TestComponent(handle: Handle<{ count: number }>) {
        return () => <div>Count: {handle.props.count}</div>
      }

      let EntryComponent = clientEntry('/js/test.js#TestComponent', TestComponent)

      expect(EntryComponent.$entry).toBe(true)
      expect(EntryComponent.$entryId).toBe('/js/test.js#TestComponent')
    })

    it('stores the original entry ID', () => {
      function MyComponent() {
        return () => <div>Hello</div>
      }

      let EntryComponent = clientEntry('my-custom-entry-id', MyComponent)

      expect(EntryComponent.$entryId).toBe('my-custom-entry-id')
    })

    it('preserves the original component functionality', () => {
      function TestComponent(handle: Handle<{ initialCount: number; label: string }>) {
        let count = handle.props.initialCount

        return () => (
          <button>
            {handle.props.label}: {count}
          </button>
        )
      }

      let EntryComponent = clientEntry('/js/test.js#TestComponent', TestComponent)

      // The entry component should still be callable
      expect(typeof EntryComponent).toBe('function')

      // Mock Handle for testing
      let mockHandle = { props: { initialCount: 5, label: 'Count' } } as Handle<{
        initialCount: number
        label: string
      }>

      // Should work the same as the original component
      let renderFn = EntryComponent(mockHandle)
      expect(typeof renderFn).toBe('function')

      if (typeof renderFn === 'function') {
        let element = renderFn(mockHandle.props)
        expect(element).toEqual({
          $rmx: true,
          type: 'button',
          props: {
            children: ['Count', ': ', 5],
          },
          key: undefined,
        })
      }
    })
  })

  describe('error handling', () => {
    it('throws error when no entry ID provided', () => {
      function TestComponent() {
        return () => <div>Test</div>
      }

      expect(() => {
        clientEntry('', TestComponent)
      }).toThrow('clientEntry() requires an entry ID')
    })

    it('preserves opaque entry IDs at declaration time', () => {
      let anonymousHttpComponent = function () {
        return () => <div>Test</div>
      }
      let anonymousFileComponent = function () {
        return () => <div>Test</div>
      }

      // Force the function name to be empty to simulate truly anonymous function
      Object.defineProperty(anonymousHttpComponent, 'name', { value: '' })
      Object.defineProperty(anonymousFileComponent, 'name', { value: '' })

      let httpEntry = clientEntry('/js/test.js', anonymousHttpComponent)
      let fileEntry = clientEntry(
        'file:///app/components/test-component.tsx',
        anonymousFileComponent,
      )

      expect(httpEntry.$entryId).toBe('/js/test.js')
      expect(fileEntry.$entryId).toBe('file:///app/components/test-component.tsx')
    })
  })

  describe('type constraints', () => {
    it('accepts components with serializable props', () => {
      // This should compile without errors
      function ValidComponent(
        handle: Handle<{
          str: string
          num: number
          bool: boolean
          obj: { nested: string }
          arr: number[]
          element: JSX.Element
        }>,
      ) {
        void handle
        return () => <div>Valid</div>
      }

      let EntryComponent = clientEntry('/js/valid.js#ValidComponent', ValidComponent)
      expect(EntryComponent.$entry).toBe(true)
    })

    // Type-level rejection: non-serializable props should be disallowed
    it('rejects components with non-serializable props', () => {
      function InvalidComponent(handle: Handle<{ func: () => void }>) {
        void handle
        return () => <div>Invalid</div>
      }

      // @ts-expect-error - non-serializable function prop should be rejected
      let HydratedInvalid = clientEntry('/js/invalid.js#InvalidComponent', InvalidComponent)
      expect(true).toBe(true)
    })

    it('accepts primitive prop values', () => {
      function Counter(handle: Handle<{ count: number }>) {
        let count = handle.props.count ?? 0
        return () => <div>Count: {count}</div>
      }

      let EntryCounter = clientEntry('/js/counter.js#Counter', Counter)
      expect(EntryCounter.$entry).toBe(true)
    })

    it('accepts null and undefined prop values', () => {
      function NullValue(handle: Handle<{ value: null }>) {
        return () => <div>Null value: {String(handle.props.value)}</div>
      }

      function UndefinedValue(handle: Handle<{ value?: undefined }>) {
        return () => <div>Undefined value: {String(handle.props.value)}</div>
      }

      let EntryNull = clientEntry('/js/null.js#NullValue', NullValue)
      let EntryUndefined = clientEntry('/js/undefined.js#UndefinedValue', UndefinedValue)

      expect(EntryNull.$entry).toBe(true)
      expect(EntryUndefined.$entry).toBe(true)
    })

    it('accepts array prop values', () => {
      function ArrayValue(handle: Handle<{ values: string[] }>) {
        return () => <div>{handle.props.values.join(', ')}</div>
      }

      let EntryArray = clientEntry('/js/array.js#ArrayValue', ArrayValue)
      expect(EntryArray.$entry).toBe(true)
    })
  })
  /* oxlint-enable eslint/no-unused-vars */

  describe('isEntry type guard', () => {
    it('returns true for entry components', () => {
      function TestComponent() {
        return () => <div>Test</div>
      }

      let EntryComponent = clientEntry('/js/test.js#TestComponent', TestComponent)
      expect(isEntry(EntryComponent)).toBe(true)
    })

    it('returns false for regular components', () => {
      function RegularComponent() {
        return () => <div>Regular</div>
      }

      expect(isEntry(RegularComponent)).toBe(false)
    })

    it('returns false for non-function values', () => {
      expect(isEntry(null)).toBe(false)
      expect(isEntry(undefined)).toBe(false)
      expect(isEntry('string')).toBe(false)
      expect(isEntry(123)).toBe(false)
      expect(isEntry({})).toBe(false)
    })

    it('returns false for functions without entry metadata', () => {
      function normalFunction() {}
      expect(isEntry(normalFunction)).toBe(false)
    })
  })

  describe('complex components', () => {
    it('handles stateful components with initialization and render phases', () => {
      function Counter(handle: Handle<{ initialCount: number; label: string }>) {
        let count = handle.props.initialCount

        return () => (
          <button type="button">
            {handle.props.label} {count}
          </button>
        )
      }

      let EntryCounter = clientEntry('/js/counter.js#Counter', Counter)

      expect(EntryCounter.$entry).toBe(true)
      expect(EntryCounter.$entryId).toBe('/js/counter.js#Counter')
    })

    it('handles simple components that return JSX directly', () => {
      function SimpleComponent(handle: Handle<{ message: string }>) {
        return () => <div>{handle.props.message}</div>
      }

      let EntrySimple = clientEntry('/js/simple.js#SimpleComponent', SimpleComponent)

      expect(EntrySimple.$entry).toBe(true)
      expect(EntrySimple.$entryId).toBe('/js/simple.js#SimpleComponent')
    })
  })
})
