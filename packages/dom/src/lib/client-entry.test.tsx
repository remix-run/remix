import { describe, expect, it } from 'vitest'
import { clientEntry, isEntry, serializeHydrationProps } from './client-entry.ts'

describe('clientEntry', () => {
  it('marks wrapped components with entry metadata', () => {
    function CounterEntry() {
      return () => <button>ok</button>
    }
    let wrapped = clientEntry('/entries/counter.js#CounterEntry', CounterEntry)
    expect(isEntry(wrapped)).toBe(true)
    expect(wrapped.$entry).toBe(true)
    expect(wrapped.$moduleUrl).toBe('/entries/counter.js')
    expect(wrapped.$exportName).toBe('CounterEntry')
  })

  it('falls back to component name when export name is omitted', () => {
    function WidgetEntry() {
      return () => <div>widget</div>
    }
    let wrapped = clientEntry('/entries/widget.js', WidgetEntry)
    expect(wrapped.$moduleUrl).toBe('/entries/widget.js')
    expect(wrapped.$exportName).toBe('WidgetEntry')
  })

  it('throws for missing module url', () => {
    function NamedEntry() {
      return () => <div>x</div>
    }
    expect(() => clientEntry('#NamedEntry', NamedEntry)).toThrow('clientEntry() requires a module URL')
  })

  it('throws when href omits export and component is anonymous', () => {
    expect(() =>
      clientEntry('/entries/anonymous.js', (_handle: any, _setup: unknown) => (_props) => <div>x</div>),
    ).toThrow(
      'clientEntry() requires either an export name in the href',
    )
  })

  it('serializes nested props and arrays', () => {
    let serialized = serializeHydrationProps({
      plain: 'ok',
      nested: { count: 1, list: [1, 'a', { deep: true }] },
    })
    expect(serialized).toEqual({
      plain: 'ok',
      nested: { count: 1, list: [1, 'a', { deep: true }] },
    })
  })

  it('rejects non-serializable hydration props', () => {
    expect(() =>
      serializeHydrationProps({
        bad: 1n as any,
      }),
    ).toThrow('clientEntry props must be serializable')

    expect(() =>
      serializeHydrationProps({
        bad: Symbol('x') as any,
      }),
    ).toThrow('clientEntry props must be serializable')

    expect(() =>
      serializeHydrationProps({
        bad() {},
      } as any),
    ).toThrow('clientEntry props must be serializable')
  })

  it('rejects circular hydration props', () => {
    let circular: Record<string, unknown> = { ok: true }
    circular.self = circular
    expect(() => serializeHydrationProps(circular)).toThrow('circular value')
  })
})
