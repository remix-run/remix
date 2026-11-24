import * as assert from '@remix-run/assert'
import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'
import { createRoot } from '../runtime/vdom.ts'
import { invariant } from '../runtime/invariant.ts'
import { createElement } from '../runtime/create-element.ts'
import { Fragment, type Handle, type RemixNode } from '../runtime/component.ts'
import { expectNodeOrder, prepareMoveState } from './utils.ts'

describe('vnode rendering (keys)', () => {
  describe('keyed list with non-keyed sibling', () => {
    it('keeps unkeyed matches in order after missing a child type', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <>
          <b key="kept" />
          <span />
          <i />
          <span />
        </>,
      )
      let [keyed, skipped, italic, span] = Array.from(container.children)

      root.render(
        <>
          <b key="kept" />
          <em />
          <i />
          <span />
          <span />
        </>,
      )
      let children = container.children
      expect(children[0]).toBe(keyed)
      expect(children[1].localName).toBe('em')
      expect(children[2]).toBe(italic)
      expect(children[3]).toBe(span)
      expect(children[4].localName).toBe('span')
      expect(skipped.parentNode).toBe(null)
    })

    it('appends keyed component before non-keyed sibling', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      type CardData = { id: string; title: string }

      function Card(handle: Handle<{ card: CardData }>) {
        return () => <div data-id={handle.props.card.id}>{handle.props.card.title}</div>
      }

      function Column(handle: Handle<{ cards: CardData[]; isAddingCard: boolean }>) {
        return () => (
          <div>
            {handle.props.cards.map((card) => (
              <Card key={card.id} card={card} />
            ))}
            {handle.props.isAddingCard ? <div id="form">Form</div> : <button>Add</button>}
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

      function List(handle: Handle<{ values: (string | number)[] }>) {
        return () => (
          <ul>
            {handle.props.values.map((value) => (
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

      function List(handle: Handle<{ values: string[] }>) {
        return () => (
          <ol>
            {handle.props.values.map((value) => (
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

      function List(handle: Handle<{ values: string[] }>) {
        return () => (
          <ul>
            {handle.props.values.map((value) => (
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

      function List(handle: Handle<{ values: string[] }>) {
        return () => (
          <ul>
            {handle.props.values.map((value) => (
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

      function List(handle: Handle<{ values: string[] }>) {
        return () => (
          <ul>
            {handle.props.values.map((value) => (
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

      function List(handle: Handle<{ values: string[] }>) {
        return () => (
          <ul>
            {handle.props.values.map((value) => (
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

      function List(handle: Handle<{ values: string[] }>) {
        return () => (
          <ul>
            {handle.props.values.map((value) => (
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

  describe('keyed insertions', () => {
    function Empty(_handle: Handle<{ value: string }>) {
      return () => null
    }

    // The value 'empty' renders a keyed component with no DOM
    function List(handle: Handle<{ values: string[] }>) {
      return () => (
        <ul>
          {handle.props.values.map((value) =>
            value === 'empty' ? <Empty key={value} value={value} /> : <li key={value}>{value}</li>,
          )}
        </ul>
      )
    }

    function renderAndCountInsertions(
      root: ReturnType<typeof createRoot>,
      list: Element,
      values: string[],
    ): { added: number; removed: number } {
      let observer = new MutationObserver(() => {})
      observer.observe(list, { childList: true })
      root.render(<List values={values} />)
      let records = observer.takeRecords()
      observer.disconnect()
      return {
        added: records.reduce((count, record) => count + record.addedNodes.length, 0),
        removed: records.reduce((count, record) => count + record.removedNodes.length, 0),
      }
    }

    it('inserts restored keyed children once at their final position', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let all = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

      root.render(<List values={all.filter((value) => Number(value) % 2 === 0)} />)
      let list = container.querySelector('ul')
      invariant(list)
      expect(list.textContent).toBe('02468')

      expect(renderAndCountInsertions(root, list, all)).toEqual({ added: 5, removed: 0 })
      expect(list.textContent).toBe('0123456789')
    })

    it('inserts new keyed children once when existing children also move', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<List values={['a', 'b', 'c', 'd']} />)
      let list = container.querySelector('ul')
      invariant(list)

      // d moves to the front, x and y are new
      let counts = renderAndCountInsertions(root, list, ['d', 'x', 'a', 'b', 'y', 'c'])
      expect(list.textContent).toBe('dxabyc')
      expect(counts).toEqual({ added: 3, removed: 1 })
    })

    it('inserts new keyed children before the next stable child that renders DOM', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<List values={['a', 'b', 'empty', 'c']} />)
      let list = container.querySelector('ul')
      invariant(list)

      // b moves to the end, x is new and the stable child after it renders no DOM
      let counts = renderAndCountInsertions(root, list, ['a', 'x', 'empty', 'c', 'b'])
      expect(list.textContent).toBe('axcb')
      expect(counts).toEqual({ added: 2, removed: 1 })
    })
  })

  describe('keyed children that change their DOM', () => {
    function List(handle: Handle<{ values: string[]; fragment: string[] }>) {
      return () => (
        <ul>
          {handle.props.values.map((value) =>
            value === 'f' ? (
              <Fragment key="f">
                {handle.props.fragment.map((child) => (
                  <li key={child}>{child}</li>
                ))}
              </Fragment>
            ) : (
              <li key={value}>{value}</li>
            ),
          )}
        </ul>
      )
    }

    it('inserts new fragment children inside the fragment when siblings follow it', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<List values={['a', 'f', 'b']} fragment={['1']} />)
      expect(container.textContent).toBe('a1b')

      root.render(<List values={['a', 'f', 'b']} fragment={['1', '2']} />)
      expect(container.textContent).toBe('a12b')
    })

    it('keeps new fragment children with the fragment when other siblings move', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<List values={['a', 'f', 'b', 'c']} fragment={['1']} />)
      expect(container.textContent).toBe('a1bc')

      root.render(<List values={['a', 'f', 'c', 'b']} fragment={['1', '2']} />)
      expect(container.textContent).toBe('a12cb')
    })

    it('inserts children into an empty fragment before the siblings that follow it', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<List values={['a', 'f', 'b']} fragment={[]} />)
      expect(container.textContent).toBe('ab')

      root.render(<List values={['a', 'f', 'b']} fragment={['1']} />)
      expect(container.textContent).toBe('a1b')
    })

    it('keeps siblings when a fragment at the end of the list loses all its children', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<List values={['a', 'f']} fragment={['1']} />)
      expect(container.textContent).toBe('a1')

      root.render(<List values={['a', 'f']} fragment={[]} />)
      expect(container.textContent).toBe('a')
    })

    it('places a keyed component that starts rendering DOM while its siblings move', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function Maybe(handle: Handle<{ show: boolean }>) {
        return () => (handle.props.show ? <li>g</li> : null)
      }

      function Items(handle: Handle<{ show: boolean; order: string[]; fragment: string[] }>) {
        return () => (
          <ul>
            {handle.props.order.map((key) =>
              key === 'g' ? (
                <Maybe key="g" show={handle.props.show} />
              ) : key === 'f' ? (
                <Fragment key="f">
                  {handle.props.fragment.map((child) => (
                    <li key={child}>{child}</li>
                  ))}
                </Fragment>
              ) : (
                <li key={key}>{key}</li>
              ),
            )}
          </ul>
        )
      }

      root.render(<Items show={false} order={['g', 'f', 'c']} fragment={['2']} />)
      expect(container.textContent).toBe('2c')

      // f moves ahead of g and gains a child before its old first child, so g's
      // old next sibling no longer marks where g belongs
      root.render(<Items show={true} order={['f', 'g', 'c']} fragment={['1', '2']} />)
      expect(container.textContent).toBe('12gc')
    })

    it('places a component inside a fragment that starts rendering DOM while siblings move', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function Maybe(handle: Handle<{ show: boolean }>) {
        return () => (handle.props.show ? <li>g</li> : null)
      }

      function Items(handle: Handle<{ show: boolean; order: string[]; fragment: string[] }>) {
        return () => (
          <ul>
            {handle.props.order.map((key) =>
              key === 'e' ? (
                <Fragment key="e">
                  <li>x</li>
                  <Maybe show={handle.props.show} />
                </Fragment>
              ) : (
                <Fragment key="f">
                  {handle.props.fragment.map((child) => (
                    <li key={child}>{child}</li>
                  ))}
                </Fragment>
              ),
            )}
          </ul>
        )
      }

      root.render(<Items show={false} order={['e', 'f']} fragment={['2']} />)
      expect(container.textContent).toBe('x2')

      // f moves ahead of e and gains a child before its old first child, so the
      // sibling after e in the old order no longer marks where e ends
      root.render(<Items show={true} order={['f', 'e']} fragment={['1', '2']} />)
      expect(container.textContent).toBe('12xg')
    })

    it('renders a keyed component that starts rendering DOM while a later sibling is removed', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function Maybe(handle: Handle<{ show: boolean }>) {
        return () => (handle.props.show ? <li>g</li> : null)
      }

      function Items(handle: Handle<{ show: boolean; values: string[] }>) {
        return () => (
          <ul>
            <Maybe key="g" show={handle.props.show} />
            {handle.props.values.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        )
      }

      root.render(<Items show={false} values={['b', 'j']} />)
      expect(container.textContent).toBe('bj')

      root.render(<Items show={true} values={['j']} />)
      expect(container.textContent).toBe('gj')
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

      function Item(handle: Handle<{ label: string }>) {
        return () => <li>{handle.props.label}</li>
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

    it('handles duplicate keys (last one wins)', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let warnSpy = t.mock.method(console, 'warn', () => {})

      function List(handle: Handle<{ labels: string[] }>) {
        return () => (
          <ul>
            {handle.props.labels.map((label, index) => (
              <li key="dup" data-index={index}>
                {label}
              </li>
            ))}
          </ul>
        )
      }

      root.render(<List labels={['first', 'second']} />)
      expect(container.textContent).toBe('firstsecond')

      root.render(<List labels={['only']} />)
      expect(container.textContent).toBe('only')

      let items = Array.from(container.querySelectorAll('li'))
      expect(items.length).toBe(1)
      expect(items[0].getAttribute('data-index')).toBe('0')
      expect(warnSpy).toHaveBeenCalledTimes(1)
      let warning = String(warnSpy.mock.calls[0]?.arguments[0] ?? '')
      expect(warning).toContain('Duplicate keys detected in siblings')
      expect(warning).toContain('"dup"')
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

      function Item(handle: Handle<{ id: string; label: string }>) {
        return () => (
          <>
            <span key={handle.props.id + '-label'} data-id={handle.props.id}>
              {handle.props.label}
            </span>
            <button key={handle.props.id + '-button'} data-id={handle.props.id + '-btn'}>
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

  describe('focus and selection across keyed moves', () => {
    it('does not collect past a keyed fragment whose last node was removed by a callback', (t) => {
      let { render, container } = createConnectedRoot(t)
      Object.defineProperty(container, 'moveBefore', { value: undefined })
      let end: Element | undefined
      customElements.define(
        'rmx-keyed-remove-pending-end',
        class extends HTMLElement {
          connectedCallback() {
            end?.remove()
          }
        },
      )
      let s1 = <p key="s1">1</p>
      let s2 = <p key="s2">2</p>
      let left = (
        <Fragment key="left">
          <span>Kept</span>
          <span id="pending-end">End</span>
        </Fragment>
      )
      let trigger = createElement('rmx-keyed-remove-pending-end', { key: 'trigger' })
      let view = (items: RemixNode[]) => (
        <>
          <Fragment key="list">{items}</Fragment>
          <aside key="outside">Outside</aside>
        </>
      )
      render(view([s1, s2, left, trigger]))
      let [first, second, kept, last, custom, outside] = Array.from(container.children)
      end = last

      render(view([left, trigger, s1, s2]))

      expect(last.parentNode).toBe(null)
      expectNodeOrder(container.children, [custom, first, second, kept, outside])
    })

    it(
      'recovers inside a keyed list when a move callback removes itself and its anchor',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let { render, container } = createConnectedRoot(t)
        let anchor: Element | undefined
        customElements.define(
          'rmx-keyed-move-remove-self',
          class extends HTMLElement {
            connectedMoveCallback() {
              anchor?.remove()
              this.remove()
            }
          },
        )
        let s1 = (
          <Fragment key="s1">
            <p>1</p>
            <span>Kept</span>
          </Fragment>
        )
        let s2 = <p key="s2">2</p>
        let moving = createElement('rmx-keyed-move-remove-self', { key: 'm' })
        let a = <p key="a">A</p>
        let view = (items: RemixNode[]) => (
          <>
            <Fragment key="list">{items}</Fragment>
            <aside key="outside">Outside</aside>
          </>
        )
        render(view([s1, s2, moving, a]))
        let [first, kept, second, custom, last, outside] = Array.from(container.children)
        anchor = first

        render(view([a, moving, s1, s2]))

        expect(first.parentNode).toBe(null)
        expect(custom.parentNode).toBe(null)
        expectNodeOrder(container.children, [last, kept, second, outside])
      },
    )

    it('recovers inside a keyed list when a fallback callback removes the placed suffix', (t) => {
      let { root, render, container } = createConnectedRoot(t)
      Object.defineProperty(container, 'moveBefore', { value: undefined })
      let errors: Event[] = []
      root.addEventListener('error', (event) => errors.push(event))
      let removed: Element[] = []
      customElements.define(
        'rmx-keyed-fallback-remove-suffix',
        class extends HTMLElement {
          connectedCallback() {
            if (!removed.length) return
            for (let node of removed) node.remove()
            this.remove()
          }
        },
      )
      let s1 = <p key="s1">1</p>
      let s2 = <p key="s2">2</p>
      let moving = createElement('rmx-keyed-fallback-remove-suffix', { key: 'm' })
      let a = <p key="a">A</p>
      let view = (items: RemixNode[]) => (
        <>
          <Fragment key="list">{items}</Fragment>
          <aside key="outside">Outside</aside>
        </>
      )
      render(view([s1, s2, moving, a]))
      let [first, second, custom, last, outside] = Array.from(container.children)
      removed = [first, second]

      render(view([a, moving, s1, s2]))

      expect(first.parentNode).toBe(null)
      expect(second.parentNode).toBe(null)
      expect(custom.parentNode).toBe(null)
      expectNodeOrder(container.children, [last, outside])
      expect(errors.length).toBe(0)
    })

    it('keeps fallback connection callbacks in source order within a moved fragment', (t) => {
      let { render, container } = createConnectedRoot(t)
      Object.defineProperty(container, 'moveBefore', { value: undefined })
      let connections: string[] = []
      customElements.define(
        'rmx-keyed-fallback-callback-order',
        class extends HTMLElement {
          connectedCallback() {
            connections.push(this.dataset.name ?? '')
          }
        },
      )
      let moving = (
        <Fragment key="a">
          start{createElement('rmx-keyed-fallback-callback-order', { 'data-name': 'one' })}
          {createElement('rmx-keyed-fallback-callback-order', { 'data-name': 'two' })}end
        </Fragment>
      )
      let b = <p key="b">B</p>
      let c = <p key="c">C</p>
      render([moving, b, c])
      connections = []

      render([b, c, moving])

      expect(connections).toEqual(['one', 'two'])
    })

    it(
      'keeps a keyed fragment together when a move callback removes its anchor',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let { render, container } = createConnectedRoot(t)
        let anchor: Element | undefined
        customElements.define(
          'rmx-keyed-move-remove-anchor',
          class extends HTMLElement {
            connectedMoveCallback() {
              anchor?.remove()
            }
          },
        )
        let moving = (
          <Fragment key="a">
            start{createElement('rmx-keyed-move-remove-anchor', {})}
            <span>Kept</span>end
          </Fragment>
        )
        let b = <p key="b">B</p>
        let c = <p key="c">C</p>
        render([b, c, moving])
        anchor = container.querySelector('p') ?? undefined
        invariant(anchor)
        let range = Array.from(container.childNodes).slice(2)
        let last = container.childNodes[1]

        render([moving, b, c])

        expect(anchor.parentNode).toBe(null)
        expectNodeOrder(container.childNodes, [...range, last])
      },
    )

    it(
      'retains the rest of a keyed fragment when a move callback removes its next node',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let { render, container } = createConnectedRoot(t)
        let removed: Element | undefined
        customElements.define(
          'rmx-keyed-move-remove-next',
          class extends HTMLElement {
            connectedMoveCallback() {
              removed?.remove()
            }
          },
        )
        let moving = (
          <Fragment key="a">
            start{createElement('rmx-keyed-move-remove-next', {})}
            <span id="removed">Removed</span>
            <span>Kept</span>end
          </Fragment>
        )
        let b = <p key="b">B</p>
        let c = <p key="c">C</p>
        render([moving, b, c])
        removed = container.querySelector('#removed') ?? undefined
        invariant(removed)
        let range = Array.from(container.childNodes)
          .slice(0, -2)
          .filter((node) => node !== removed)
        let rest = Array.from(container.childNodes).slice(-2)

        render([b, c, moving])

        expect(removed.parentNode).toBe(null)
        expectNodeOrder(container.childNodes, [...rest, ...range])
      },
    )

    it(
      'uses connectedMoveCallback only for custom elements that define it',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let connections = 0
        let disconnections = 0
        let moves = 0
        let legacyConnections = 0
        let legacyDisconnections = 0
        let tag = 'rmx-keyed-native-move'
        let legacyTag = 'rmx-keyed-legacy-move'
        customElements.define(
          tag,
          class extends HTMLElement {
            connectedCallback() {
              connections++
            }
            disconnectedCallback() {
              disconnections++
            }
            connectedMoveCallback() {
              moves++
            }
          },
        )
        customElements.define(
          legacyTag,
          class extends HTMLElement {
            connectedCallback() {
              legacyConnections++
            }
            disconnectedCallback() {
              legacyDisconnections++
            }
          },
        )
        let { render } = createConnectedRoot(t)
        let moving = (
          <div key="a">
            {createElement(tag, {})}
            {createElement(legacyTag, {})}
          </div>
        )
        let b = <span key="b">B</span>
        let c = <span key="c">C</span>
        render([moving, b, c])

        render([b, c, moving])

        expect(connections).toBe(1)
        expect(disconnections).toBe(0)
        expect(moves).toBe(1)
        expect(legacyConnections).toBe(2)
        expect(legacyDisconnections).toBe(1)
      },
    )

    it(
      'preserves browser state when a keyed fragment range moves in either direction',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      async (t) => {
        let { render, container } = createConnectedRoot(t)
        let moving = (
          <Fragment key="a">
            start
            <iframe />
            <div data-move-animation="" />
            <dialog>
              <input />
            </dialog>
            <div popover="manual" />
            end
          </Fragment>
        )
        let b = <span key="b">B</span>
        let c = <span key="c">C</span>
        render([moving, b, c])
        let assertState = await prepareMoveState(t, container)

        render([b, c, moving])
        assertState()
        expect(container.textContent).toBe('BCstartend')

        render([moving, b, c])
        assertState()
        expect(container.textContent).toBe('startendBC')
      },
    )

    it('restores focus and selection when native moves are unavailable', (t) => {
      let { render, container } = createConnectedRoot(t)
      Object.defineProperty(container, 'moveBefore', { value: undefined })
      let item = (key: string) => <input key={key} id={key} />
      render(['a', 'b', 'c'].map(item))
      let input = getInput(container, 'a')
      input.value = 'Hello World'
      input.focus()
      input.setSelectionRange(6, 11)

      expectToMove(input, () => render(['b', 'c', 'a'].map(item)))

      expect(Array.from(container.children, (node) => node.id)).toEqual(['b', 'c', 'a'])
      expect(document.activeElement).toBe(input)
      expect(input.selectionStart).toBe(6)
      expect(input.selectionEnd).toBe(11)
    })

    it('keeps focus and selection on a text input that a keyed reorder moves', (t) => {
      let { render, container } = createConnectedRoot(t)
      let item = (key: string) => <input key={key} id={key} type="text" />
      render(['a', 'b', 'c'].map(item))
      let input = getInput(container, 'a')
      input.value = 'Hello World'
      input.focus()
      input.setSelectionRange(6, 11)

      expectToMove(input, () => render(['b', 'c', 'a'].map(item)))

      expect(document.activeElement).toBe(input)
      expect(input.selectionStart).toBe(6)
      expect(input.selectionEnd).toBe(11)
    })

    it('restores ancestor scroll after focus handlers run during a keyed move', (t) => {
      let { render, container } = createConnectedRoot(t)
      Object.defineProperty(container, 'moveBefore', { value: undefined })
      container.style.cssText = 'height: 40px; overflow: auto; overflow-anchor: none'
      let item = (key: string) => (
        <input key={key} id={key} style={{ display: 'block', height: '60px' }} />
      )
      render(['a', 'b', 'c'].map(item))
      let input = getInput(container, 'a')
      input.focus()
      container.scrollTop = 10
      let restored = false
      input.addEventListener('focus', () => {
        restored = true
        container.scrollTop = 50
      })

      expectToMove(input, () => render(['b', 'c', 'a'].map(item)))

      expect(restored).toBe(true)
      expect(container.scrollTop).toBe(10)
    })

    it('keeps focus and selection on a textarea that a keyed reorder moves', (t) => {
      let { render, container } = createConnectedRoot(t)
      let item = (key: string) => <textarea key={key} id={key} />
      render(['a', 'b', 'c'].map(item))
      let textarea = container.querySelector('#a')
      invariant(textarea instanceof HTMLTextAreaElement)
      textarea.value = 'Hello\nWorld\nTest'
      textarea.focus()
      textarea.setSelectionRange(6, 11)

      expectToMove(textarea, () => render(['b', 'c', 'a'].map(item)))

      expect(document.activeElement).toBe(textarea)
      expect(textarea.selectionStart).toBe(6)
      expect(textarea.selectionEnd).toBe(11)
    })

    it('keeps the selection for every text-like input type', (t) => {
      let { render, container } = createConnectedRoot(t)
      for (let type of ['search', 'tel', 'url', 'password']) {
        let item = (key: string) => createElement('input', { key, id: key, type })
        render(['a', 'b', 'c'].map(item))
        let input = getInput(container, 'a')
        input.value = 'test value'
        input.focus()
        input.setSelectionRange(0, 4)

        expectToMove(input, () => render(['b', 'c', 'a'].map(item)))

        expect(document.activeElement).toBe(input)
        expect(input.selectionStart).toBe(0)
        expect(input.selectionEnd).toBe(4)
        render([])
      }
    })

    it('keeps focus on inputs that do not support text selection', (t) => {
      let { render, container } = createConnectedRoot(t)
      for (let type of ['email', 'number', 'checkbox', 'range']) {
        let item = (key: string) => createElement('input', { key, id: key, type })
        render(['a', 'b', 'c'].map(item))
        let input = getInput(container, 'a')
        input.focus()

        expectToMove(input, () => render(['b', 'c', 'a'].map(item)))

        expect(document.activeElement).toBe(input)
        render([])
      }
    })

    it('keeps focus on focusable and contentEditable elements that a keyed reorder moves', (t) => {
      let { render, container } = createConnectedRoot(t)
      let item = (key: string) =>
        key === 'editable' ? (
          <div key={key} id={key} contentEditable="true">
            Hello World
          </div>
        ) : (
          <div key={key} id={key} tabIndex={-1} />
        )
      for (let focused of ['focusable', 'editable']) {
        render([focused, 'b', 'c'].map(item))
        let element = container.querySelector(`#${focused}`)
        invariant(element instanceof HTMLElement)
        element.focus()

        expectToMove(element, () => render(['b', 'c', focused].map(item)))

        expect(document.activeElement).toBe(element)
        render([])
      }
    })
  })
})

function createConnectedRoot(t: TestContext) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  t.after(() => {
    root.dispose()
    container.remove()
  })
  return { root, container, render: (node: RemixNode) => root.render(node) }
}

function getInput(container: HTMLElement, id: string): HTMLInputElement {
  let input = container.querySelector(`#${id}`)
  invariant(input instanceof HTMLInputElement)
  return input
}

// Moving a focused element out of the DOM and back drops its focus and selection, which is what
// the scheduler restores. Which element a keyed reorder moves is the reconciler's choice, so fail
// loudly if it stops moving this one instead of letting the test pass without testing restoration.
function expectToMove(element: Element, update: () => void): void {
  let parent = element.parentNode
  invariant(parent)
  let observer = new MutationObserver(() => {})
  observer.observe(parent, { childList: true })
  update()
  let records = observer.takeRecords()
  observer.disconnect()
  let moved = records.some((record) => Array.from(record.removedNodes).includes(element))
  assert.ok(moved, 'Expected the update to move the focused element. Reorder the keys so it does.')
  expect(element.isConnected).toBe(true)
}
