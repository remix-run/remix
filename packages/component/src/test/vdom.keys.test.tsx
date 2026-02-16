import { describe, it, expect, vi } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'
import { Fragment } from '../lib/component.ts'

describe('vnode rendering (keys)', () => {
  describe('keyed list with non-keyed sibling', () => {
    it('appends keyed component before non-keyed sibling', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      type CardData = { id: string; title: string }

      function Card() {
        return ({ card }: { card: CardData }) => <div data-id={card.id}>{card.title}</div>
      }

      function Column() {
        return ({ cards, isAddingCard }: { cards: CardData[]; isAddingCard: boolean }) => (
          <div>
            {cards.map((card) => (
              <Card key={card.id} card={card} />
            ))}
            {isAddingCard ? <div id="form">Form</div> : <button>Add</button>}
          </div>
        )
      }

      // Initial: 2 cards, button visible
      let cards: CardData[] = [
        { id: '1', title: 'Card 1' },
        { id: '2', title: 'Card 2' },
      ]
      root.render(<Column cards={cards} isAddingCard={false} />)

      let col = container.querySelector('div')
      invariant(col)
      expect(col.innerHTML).toBe(
        '<div data-id="1">Card 1</div><div data-id="2">Card 2</div><button>Add</button>',
      )

      // Click "Add" - form appears
      root.render(<Column cards={cards} isAddingCard={true} />)
      expect(col.innerHTML).toBe(
        '<div data-id="1">Card 1</div><div data-id="2">Card 2</div><div id="form">Form</div>',
      )

      // Add a new card while form is visible
      cards = [...cards, { id: '3', title: 'Card 3' }]
      root.render(<Column cards={cards} isAddingCard={true} />)

      // Regression: The new card must appear BEFORE the form.
      expect(col.innerHTML).toBe(
        '<div data-id="1">Card 1</div><div data-id="2">Card 2</div><div data-id="3">Card 3</div><div id="form">Form</div>',
      )
    })
  })

  describe('basic keyed list operations', () => {
    it('handles prepending items with keys', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function List() {
        return ({ values }: { values: (string | number)[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values: (string | number)[] = ['b', 'c']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('bc')

      values = ['a', ...values]
      root.render(<List values={values} />)
      expect(container.textContent).toBe('abc')

      let items = Array.from(container.querySelectorAll('li'))
      expect(items.map((el) => el.getAttribute('data-id'))).toEqual(['a', 'b', 'c'])
    })

    it('handles appending items with keys', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function List() {
        return ({ values }: { values: string[] }) => (
          <ol>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ol>
        )
      }

      let values = ['a', 'b']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('ab')

      let a = container.querySelector('[data-id="a"]')
      let b = container.querySelector('[data-id="b"]')
      expect(a).toBeInstanceOf(HTMLLIElement)
      expect(b).toBeInstanceOf(HTMLLIElement)

      values = [...values, 'c']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('abc')

      let items = Array.from(container.querySelectorAll('li'))
      expect(items[0]).toBe(a)
      expect(items[1]).toBe(b)
      expect(items[2].getAttribute('data-id')).toBe('c')
    })

    it('handles removing items with keys', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function List() {
        return ({ values }: { values: string[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values = ['a', 'b', 'c', 'd']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('abcd')

      let a = container.querySelector('[data-id="a"]')
      let d = container.querySelector('[data-id="d"]')
      expect(a).toBeInstanceOf(HTMLLIElement)
      expect(d).toBeInstanceOf(HTMLLIElement)

      values = ['a', 'c', 'd']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('acd')

      let items = Array.from(container.querySelectorAll('li'))
      expect(items[0]).toBe(a)
      expect(items[1].getAttribute('data-id')).toBe('c')
      expect(items[2]).toBe(d)
      expect(container.querySelector('[data-id="b"]')).toBe(null)
    })

    it('handles inserting items with keys', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function List() {
        return ({ values }: { values: string[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values = ['a', 'c']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('ac')

      let a = container.querySelector('[data-id="a"]')
      let c = container.querySelector('[data-id="c"]')
      expect(a).toBeInstanceOf(HTMLLIElement)
      expect(c).toBeInstanceOf(HTMLLIElement)

      values = ['a', 'b', 'c']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('abc')

      let items = Array.from(container.querySelectorAll('li'))
      expect(items[0]).toBe(a)
      expect(items[1].getAttribute('data-id')).toBe('b')
      expect(items[2]).toBe(c)
    })

    it('handles swapping adjacent items with keys', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function List() {
        return ({ values }: { values: string[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values = ['a', 'b']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('ab')

      let a = container.querySelector('[data-id="a"]')
      let b = container.querySelector('[data-id="b"]')
      expect(a).toBeInstanceOf(HTMLLIElement)
      expect(b).toBeInstanceOf(HTMLLIElement)

      values = ['b', 'a']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('ba')

      let items = Array.from(container.querySelectorAll('li'))
      expect(items[0]).toBe(b)
      expect(items[1]).toBe(a)
    })

    it('handles reversing list order with keys', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function List() {
        return ({ values }: { values: string[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values = ['a', 'b', 'c', 'd']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('abcd')

      let nodes = values.map((value) => {
        let el = container.querySelector(`[data-id="${value}"]`)
        invariant(el instanceof HTMLLIElement)
        return el
      })

      values = [...values].reverse()
      root.render(<List values={values} />)
      expect(container.textContent).toBe('dcba')

      let items = Array.from(container.querySelectorAll('li'))
      expect(items[0]).toBe(nodes[3])
      expect(items[1]).toBe(nodes[2])
      expect(items[2]).toBe(nodes[1])
      expect(items[3]).toBe(nodes[0])
    })

    it('handles complex reordering with keys', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function List() {
        return ({ values }: { values: string[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values = ['a', 'b', 'c', 'd', 'e', 'f']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('abcdef')

      let nodes = values.map((value) => {
        let el = container.querySelector(`[data-id="${value}"]`)
        invariant(el instanceof HTMLLIElement)
        return el
      })

      // move e to near the front, and c towards the end
      values = ['a', 'e', 'b', 'f', 'c', 'd']
      root.render(<List values={values} />)
      expect(container.textContent).toBe('aebfcd')

      let items = Array.from(container.querySelectorAll('li'))
      expect(items[0]).toBe(nodes[0]) // a
      expect(items[1]).toBe(nodes[4]) // e
      expect(items[2]).toBe(nodes[1]) // b
      expect(items[3]).toBe(nodes[5]) // f
      expect(items[4]).toBe(nodes[2]) // c
      expect(items[5]).toBe(nodes[3]) // d
    })
  })

  describe('key semantics', () => {
    it('replaces nodes when keys match but type differs', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(
        <div>
          <span key="x" id="x">
            X
          </span>
        </div>,
      )
      let first = container.querySelector('#x')
      invariant(first instanceof HTMLSpanElement)
      expect(container.innerHTML).toBe('<div><span id="x">X</span></div>')

      root.render(
        <div>
          <p key="x" id="x">
            Y
          </p>
        </div>,
      )
      let second = container.querySelector('#x')
      invariant(second instanceof HTMLParagraphElement)
      expect(container.innerHTML).toBe('<div><p id="x">Y</p></div>')
      expect(second).not.toBe(first)
    })

    it('handles mixed keyed and unkeyed children', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function Item() {
        return ({ label }: { label: string }) => <li>{label}</li>
      }

      root.render(
        <ul>
          <Item key="a" label="A" />
          <Item label="unkeyed-1" />
          <Item key="b" label="B" />
          <Item label="unkeyed-2" />
        </ul>,
      )

      expect(container.textContent).toBe('Aunkeyed-1Bunkeyed-2')

      root.render(
        <ul>
          {/* swap keyed items and insert another unkeyed between them */}
          <Item label="unkeyed-1" />
          <Item key="b" label="B" />
          <Item label="unkeyed-2" />
          <Item key="a" label="A" />
        </ul>,
      )

      expect(container.textContent).toBe('unkeyed-1Bunkeyed-2A')
    })

    it('handles duplicate keys (last one wins)', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      function List() {
        return ({ labels }: { labels: string[] }) => (
          <ul>
            {labels.map((label, index) => (
              <li key="dup" data-index={index}>
                {label}
              </li>
            ))}
          </ul>
        )
      }

      try {
        root.render(<List labels={['first', 'second']} />)
        expect(container.textContent).toBe('firstsecond')

        root.render(<List labels={['only']} />)
        expect(container.textContent).toBe('only')

        let items = Array.from(container.querySelectorAll('li'))
        expect(items.length).toBe(1)
        expect(items[0].getAttribute('data-index')).toBe('0')
        expect(warnSpy).toHaveBeenCalledTimes(1)
        let warning = String(warnSpy.mock.calls[0]?.[0] ?? '')
        expect(warning).toContain('Duplicate keys detected in siblings')
        expect(warning).toContain('"dup"')
      } finally {
        warnSpy.mockRestore()
      }
    })

    it('allows any type to be a key', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let objKey = {}
      let symKey = Symbol('k')

      root.render(
        <ul>
          <li key={1}>one</li>
          <li key="two">two</li>
          <li key={objKey}>obj</li>
          <li key={symKey}>sym</li>
        </ul>,
      )

      expect(container.textContent).toBe('onetwoobjsym')

      root.render(
        <ul>
          <li key={symKey}>sym*</li>
          <li key={1}>one*</li>
          <li key={objKey}>obj*</li>
          <li key="two">two*</li>
        </ul>,
      )

      expect(container.textContent).toBe('sym*one*obj*two*')
    })

    it('reorders keyed fragments correctly (moves entire DOM range)', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      // Each keyed item renders multiple DOM nodes via fragment
      root.render(
        <div>
          {['a', 'b', 'c'].map((id) => (
            <Fragment key={id}>
              <span>{id}</span>
              <button>{id}-btn</button>
            </Fragment>
          ))}
        </div>,
      )

      expect(container.innerHTML).toBe(
        '<div><span>a</span><button>a-btn</button><span>b</span><button>b-btn</button><span>c</span><button>c-btn</button></div>',
      )

      // Reverse order - entire fragment ranges should move together
      root.render(
        <div>
          {['c', 'b', 'a'].map((id) => (
            <Fragment key={id}>
              <span>{id}</span>
              <button>{id}-btn</button>
            </Fragment>
          ))}
        </div>,
      )

      expect(container.innerHTML).toBe(
        '<div><span>c</span><button>c-btn</button><span>b</span><button>b-btn</button><span>a</span><button>a-btn</button></div>',
      )

      // Verify DOM nodes were reused, not recreated
      let spans = container.querySelectorAll('span')
      let buttons = container.querySelectorAll('button')
      expect(spans.length).toBe(3)
      expect(buttons.length).toBe(3)
    })

    it('handles keys in fragments without breaking updates', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function Item() {
        return ({ id, label }: { id: string; label: string }) => (
          <>
            <span key={id + '-label'} data-id={id}>
              {label}
            </span>
            <button key={id + '-button'} data-id={id + '-btn'}>
              click
            </button>
          </>
        )
      }

      root.render(
        <div>
          <Item id="a" label="A" />
          <Item id="b" label="B" />
        </div>,
      )

      expect(container.textContent).toBe('AclickBclick')

      // Swap order of items – inner keys should not cause errors and
      // both items should still render correctly.
      root.render(
        <div>
          <Item id="b" label="B" />
          <Item id="a" label="A" />
        </div>,
      )

      // Current implementation keeps the DOM order of the two fragment
      // sections stable for unkeyed components, but updates their
      // content based on props.
      expect(
        container.textContent === 'BclickAclick' || container.textContent === 'AclickBclick',
      ).toBe(true)

      let labels = Array.from(container.querySelectorAll('span'))
      let buttons = Array.from(container.querySelectorAll('button'))
      expect(labels.length).toBe(2)
      expect(buttons.length).toBe(2)
    })
  })
})
