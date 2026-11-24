import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../runtime/invariant.ts'
import { diffNodes } from '../runtime/diff-dom.ts'
import type { FrameContext } from '../runtime/frame.ts'
import { setClientEntryBoundaryOwner, type ClientEntryIdentity } from '../runtime/frame-runtime.ts'
import { expectNodeOrder, prepareMoveState } from './utils.ts'

function attachClientEntryOwner(
  marker: Comment,
  onDispose = () => {},
  identity: ClientEntryIdentity = { moduleUrl: '/entry.js', exportName: 'Entry' },
): void {
  setClientEntryBoundaryOwner(marker, marker, identity, { dispose: onDispose, render() {} })
}

function diffDomNodes(current: Node[], next: Node[], data: FrameContext['data'] = {}) {
  diffNodes(current, next, {
    registry: { instances: new WeakMap() },
    data,
  } as any)
}

function parseHead(html: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head>${html}</head></html>`,
    'text/html',
  )
}

function diffHead(
  current: Document,
  nextHead: string,
  shouldPreserveHeadNode?: (node: Node) => boolean,
) {
  diffNodes([current.head], [parseHead(nextHead).head], {
    registry: { instances: new WeakMap() },
    data: {},
    shouldPreserveHeadNode,
  } as any)
}

function recordMutations(target: Node) {
  let observer = new MutationObserver(() => {})
  observer.observe(target, { childList: true, attributes: true, subtree: true })
  return () => {
    let records = observer.takeRecords()
    observer.disconnect()
    return {
      removed: records.flatMap((record) => Array.from(record.removedNodes)),
      attributeTargets: records
        .filter((record) => record.type === 'attributes')
        .map((record) => record.target),
    }
  }
}

type TestFrame = {
  dispose(): void
  isDisplayingResolvedContent(): boolean
  readonly identity: { src: string; name?: string } | undefined
  renderMarkerContent(): Promise<void>
}

function diffDom(
  container: HTMLElement,
  next: string,
  data?: FrameContext['data'],
  frameInstances: WeakMap<Comment, TestFrame> = new WeakMap(),
) {
  let template = document.createElement('template')
  template.innerHTML = next
  diffNodes(Array.from(container.childNodes), Array.from(template.content.childNodes), {
    registry: { instances: frameInstances },
    data: data ?? {},
  } as any)
}

describe('diffNodes', () => {
  describe('state-preserving moves', () => {
    it(
      'does not collect past a live boundary whose end was removed by a move callback',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let end: ChildNode | undefined
        customElements.define(
          'rmx-frame-remove-pending-end',
          class extends HTMLElement {
            connectedMoveCallback() {
              end?.remove()
            }
          },
        )
        let stable = '<p data-rmx-key="s1">1</p><p data-rmx-key="s2">2</p>'
        let left = '<!-- rmx:h:left --><span>Kept</span><!-- /rmx:h -->'
        let trigger =
          '<rmx-frame-remove-pending-end data-rmx-key="m"></rmx-frame-remove-pending-end>'
        container.innerHTML = stable + left + trigger + '<aside>Outside</aside>'
        let [first, second, start, kept, last, custom, outside] = Array.from(container.childNodes)
        invariant(start instanceof Comment)
        attachClientEntryOwner(start)
        end = last

        diffDom(container, left + trigger + stable + '<aside>Outside</aside>', {
          h: { left: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
        })

        expect(last.parentNode).toBe(null)
        expectNodeOrder(container.childNodes, [custom, first, second, start, kept, outside])
      },
    )

    it(
      'keeps callback-created siblings inside a moved boundary and disposes them with it',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let created = document.createElement('em')
        let preceding = document.createElement('strong')
        customElements.define(
          'rmx-moving-range-insert-sibling',
          class extends HTMLElement {
            connectedMoveCallback() {
              this.before(preceding)
              this.after(created)
            }
          },
        )
        let moving =
          '<!-- rmx:h:a --><rmx-moving-range-insert-sibling></rmx-moving-range-insert-sibling>' +
          '<span>Kept</span><!-- /rmx:h -->'
        let rest = '<p data-rmx-key="b">B</p>'
        container.innerHTML = rest + moving
        let start = container.childNodes[1]
        invariant(start instanceof Comment)
        attachClientEntryOwner(start)
        let anchor = container.firstChild
        invariant(anchor)
        let range = Array.from(container.childNodes).slice(1)

        diffDom(container, moving + rest, {
          h: { a: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
        })

        expectNodeOrder(container.childNodes, [
          range[0],
          preceding,
          range[1],
          created,
          ...range.slice(2),
          anchor,
        ])

        diffDom(container, rest)

        expect(created.parentNode).toBe(null)
        expect(preceding.parentNode).toBe(null)
        expect(container.innerHTML).toBe(rest)
      },
    )

    it(
      'recovers inside a frame region when a move callback removes itself and its anchor',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let anchor: Element | undefined
        customElements.define(
          'rmx-frame-move-remove-anchor-and-self',
          class extends HTMLElement {
            connectedMoveCallback() {
              anchor?.remove()
              this.remove()
            }
          },
        )
        let stable = '<p data-rmx-key="s1">1</p><p data-rmx-key="s2">2</p>'
        let moving =
          '<rmx-frame-move-remove-anchor-and-self data-rmx-key="m"></rmx-frame-move-remove-anchor-and-self>'
        let sibling = '<p data-rmx-key="a">A</p>'
        container.innerHTML = stable + moving + sibling + '<aside>Outside</aside>'
        let [first, second, custom, last, outside] = Array.from(container.children)
        anchor = first
        let template = document.createElement('template')
        template.innerHTML = sibling + moving + stable

        diffDomNodes(
          Array.from(container.childNodes).slice(0, -1),
          Array.from(template.content.childNodes),
        )

        expect(first.parentNode).toBe(null)
        expect(custom.parentNode).toBe(null)
        expectNodeOrder(container.children, [last, second, outside])
      },
    )

    it(
      'does not reinsert a matched sibling removed by an earlier move callback',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let removed: Element | undefined
        customElements.define(
          'rmx-moving-unit-remove-sibling',
          class extends HTMLElement {
            connectedMoveCallback() {
              removed?.remove()
            }
          },
        )
        let stable = '<p data-rmx-key="s1">1</p><p data-rmx-key="s2">2</p>'
        let moving =
          '<rmx-moving-unit-remove-sibling data-rmx-key="m"></rmx-moving-unit-remove-sibling>'
        let sibling = '<p data-rmx-key="a">A</p>'
        container.innerHTML = stable + moving + sibling
        let [s1, s2, custom, a] = Array.from(container.children)
        removed = a

        diffDom(container, sibling + moving + stable)

        expect(removed.parentNode).toBe(null)
        expectNodeOrder(container.children, [custom, s1, s2])
      },
    )

    it(
      'stops placement when a callback removes the owning region boundary',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let boundary: Node | undefined
        customElements.define(
          'rmx-frame-move-remove-region-boundary',
          class extends HTMLElement {
            connectedMoveCallback() {
              boundary?.parentNode?.removeChild(boundary)
              this.remove()
            }
          },
        )
        let stable = '<p data-rmx-key="s1">1</p><p data-rmx-key="s2">2</p>'
        let moving =
          '<rmx-frame-move-remove-region-boundary data-rmx-key="m"></rmx-frame-move-remove-region-boundary>'
        let sibling = '<p data-rmx-key="a">A</p>'
        container.innerHTML = stable + moving + sibling + '<!-- /rmx:f --><aside>Outside</aside>'
        let [first, second, custom, last, end, outside] = Array.from(container.childNodes)
        boundary = end
        let template = document.createElement('template')
        template.innerHTML = sibling + moving + stable

        diffDomNodes(
          Array.from(container.childNodes).slice(0, -2),
          Array.from(template.content.childNodes),
        )

        expect(end.parentNode).toBe(null)
        expect(custom.parentNode).toBe(null)
        expectNodeOrder(container.childNodes, [first, second, last, outside])
      },
    )

    it(
      'keeps pending content inside its range when the only insertion anchor is removed',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let anchor: Element | undefined
        customElements.define(
          'rmx-moving-range-only-anchor',
          class extends HTMLElement {
            connectedMoveCallback() {
              anchor?.remove()
            }
          },
        )
        let moving =
          '<!-- rmx:h:a --><rmx-moving-range-only-anchor></rmx-moving-range-only-anchor>' +
          '<span>Kept</span><!-- /rmx:h -->'
        let rest = '<p data-rmx-key="b">B</p>'
        container.innerHTML = rest + moving
        let start = container.childNodes[1]
        invariant(start instanceof Comment)
        attachClientEntryOwner(start)
        anchor = container.querySelector('p') ?? undefined
        invariant(anchor)
        let range = Array.from(container.childNodes).slice(1)

        diffDom(container, moving + rest, {
          h: { a: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
        })

        expect(anchor.parentNode).toBe(null)
        expectNodeOrder(container.childNodes, range)
      },
    )

    it(
      'keeps a range together when its anchor moves elsewhere in the same parent',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let anchor: Element | undefined
        customElements.define(
          'rmx-moving-range-shift-anchor',
          class extends HTMLElement {
            connectedMoveCallback() {
              if (anchor) container.prepend(anchor)
            }
          },
        )
        let moving =
          '<!-- rmx:h:a --><rmx-moving-range-shift-anchor></rmx-moving-range-shift-anchor>' +
          '<span>Kept</span><!-- /rmx:h -->'
        let rest = '<p data-rmx-key="b">B</p>'
        container.innerHTML = rest + moving
        let start = container.childNodes[1]
        invariant(start instanceof Comment)
        attachClientEntryOwner(start)
        anchor = container.querySelector('p') ?? undefined
        invariant(anchor)
        let range = Array.from(container.childNodes).slice(1)

        diffDom(container, moving + rest, {
          h: { a: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
        })

        expectNodeOrder(container.childNodes, [anchor, ...range])
      },
    )

    it(
      'retains range content when a move callback removes itself and the anchor',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let anchor: Element | undefined
        customElements.define(
          'rmx-moving-range-remove-self',
          class extends HTMLElement {
            connectedMoveCallback() {
              this.remove()
              anchor?.remove()
            }
          },
        )
        let moving =
          '<!-- rmx:h:a --><rmx-moving-range-remove-self></rmx-moving-range-remove-self>' +
          '<span>Kept</span><!-- /rmx:h -->'
        let rest = '<p data-rmx-key="b">B</p><p data-rmx-key="c">C</p>'
        container.innerHTML = rest + moving
        let start = container.childNodes[2]
        invariant(start instanceof Comment)
        attachClientEntryOwner(start)
        anchor = container.querySelector('p') ?? undefined
        invariant(anchor)
        let range = Array.from(container.childNodes)
          .slice(2)
          .filter((node) => node.nodeName !== 'RMX-MOVING-RANGE-REMOVE-SELF')
        let last = container.childNodes[1]

        diffDom(container, moving + rest, {
          h: { a: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
        })

        expect(anchor.parentNode).toBe(null)
        expectNodeOrder(container.childNodes, [...range, last])
      },
    )

    it('does not restore nodes removed by a connection callback during a range move', (t) => {
      let container = document.createElement('div')
      document.body.append(container)
      t.after(() => container.remove())
      let removed: Element | undefined
      customElements.define(
        'rmx-moving-range-legacy-remove',
        class extends HTMLElement {
          connectedCallback() {
            removed?.remove()
          }
        },
      )
      let moving =
        '<!-- rmx:h:a --><rmx-moving-range-legacy-remove></rmx-moving-range-legacy-remove>' +
        '<span id="removed">Removed</span><span>Kept</span><!-- /rmx:h -->'
      let rest = '<p data-rmx-key="b">B</p><p data-rmx-key="c">C</p>'
      container.innerHTML = moving + rest
      let start = container.firstChild
      invariant(start instanceof Comment)
      attachClientEntryOwner(start)
      removed = container.querySelector('#removed') ?? undefined
      invariant(removed)
      let range = Array.from(container.childNodes)
        .slice(0, -2)
        .filter((node) => node !== removed)

      diffDom(container, rest + moving, {
        h: { a: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
      })

      expect(removed.parentNode).toBe(null)
      expectNodeOrder(Array.from(container.childNodes).slice(2), range)
    })

    it(
      'does not reclaim nodes reparented by a move callback during a range move',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let container = document.createElement('div')
        let destination = document.createElement('div')
        document.body.append(container, destination)
        t.after(() => {
          container.remove()
          destination.remove()
        })
        let reparented: Element | undefined
        customElements.define(
          'rmx-moving-range-reparent',
          class extends HTMLElement {
            connectedMoveCallback() {
              if (reparented) destination.append(reparented)
            }
          },
        )
        let moving =
          '<!-- rmx:h:a --><rmx-moving-range-reparent></rmx-moving-range-reparent>' +
          '<span id="reparented">Moved</span><span>Kept</span><!-- /rmx:h -->'
        let rest = '<p data-rmx-key="b">B</p><p data-rmx-key="c">C</p>'
        container.innerHTML = moving + rest
        let start = container.firstChild
        invariant(start instanceof Comment)
        attachClientEntryOwner(start)
        reparented = container.querySelector('#reparented') ?? undefined
        invariant(reparented)
        let range = Array.from(container.childNodes)
          .slice(0, -2)
          .filter((node) => node !== reparented)

        diffDom(container, rest + moving, {
          h: { a: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
        })

        expect(reparented.parentNode).toBe(destination)
        expectNodeOrder(Array.from(container.childNodes).slice(2), range)
      },
    )

    it(
      'keeps a moved range together when a move callback removes the insertion anchor',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let anchor: Element | undefined
        customElements.define(
          'rmx-moving-range-anchor',
          class extends HTMLElement {
            connectedMoveCallback() {
              anchor?.remove()
            }
          },
        )
        let moving =
          '<!-- rmx:h:a --><rmx-moving-range-anchor></rmx-moving-range-anchor>' +
          '<span>Kept</span><!-- /rmx:h -->'
        let rest = '<p data-rmx-key="b">B</p><p data-rmx-key="c">C</p>'
        container.innerHTML = rest + moving
        let start = container.childNodes[2]
        invariant(start instanceof Comment)
        attachClientEntryOwner(start)
        anchor = container.querySelector('[data-rmx-key="b"]') ?? undefined
        invariant(anchor)
        let range = Array.from(container.childNodes).slice(2)
        let last = container.childNodes[1]

        diffDom(container, moving + rest, {
          h: { a: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
        })

        expect(anchor.parentNode).toBe(null)
        expectNodeOrder(container.childNodes, [...range, last])
      },
    )

    it(
      'preserves browser state when a keyed element moves',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      async (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let moving =
          '<section data-rmx-key="a"><iframe srcdoc=""></iframe><div data-move-animation></div>' +
          '<dialog><input></dialog><div popover="manual"></div></section>'
        let rest = '<p data-rmx-key="b">B</p><p data-rmx-key="c">C</p>'
        container.innerHTML = moving + rest
        let section = container.firstChild
        let assertState = await prepareMoveState(t, container)

        diffDom(container, rest + moving)

        expect(container.lastChild).toBe(section)
        assertState()
      },
    )

    it(
      'preserves browser state and ordering when a live hydration range moves',
      { skip: typeof Element.prototype.moveBefore !== 'function' },
      async (t) => {
        let container = document.createElement('div')
        document.body.append(container)
        t.after(() => container.remove())
        let moving =
          '<!-- rmx:h:a -->start<iframe srcdoc=""></iframe><div data-move-animation></div>' +
          '<dialog><input></dialog><div popover="manual"></div>end<!-- /rmx:h -->'
        let rest = '<p data-rmx-key="b">B</p><p data-rmx-key="c">C</p>'
        container.innerHTML = moving + rest
        let start = container.firstChild
        invariant(start instanceof Comment)
        attachClientEntryOwner(start)
        let range = Array.from(container.childNodes).slice(0, -2)
        let assertState = await prepareMoveState(t, container)
        let data = { h: { a: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } } }

        diffDom(container, rest + moving, data)
        expectNodeOrder(Array.from(container.childNodes).slice(2), range)
        assertState()

        diffDom(container, moving + rest, data)
        expectNodeOrder(Array.from(container.childNodes).slice(0, -2), range)
        assertState()
      },
    )

    it('recovers a fallback range anchor after disconnection callbacks run', (t) => {
      let container = document.createElement('div')
      document.body.append(container)
      t.after(() => container.remove())
      Object.defineProperty(container, 'moveBefore', { value: undefined })
      let anchor: Element | undefined
      customElements.define(
        'rmx-fallback-range-remove-anchor',
        class extends HTMLElement {
          disconnectedCallback() {
            anchor?.remove()
          }
        },
      )
      let moving =
        '<!-- rmx:h:a -->start<rmx-fallback-range-remove-anchor></rmx-fallback-range-remove-anchor>' +
        '<input>end<!-- /rmx:h -->'
      let rest = '<p data-rmx-key="b">B</p><p data-rmx-key="c">C</p>'
      container.innerHTML = rest + moving
      let start = container.childNodes[2]
      invariant(start instanceof Comment)
      attachClientEntryOwner(start)
      anchor = container.querySelector('p') ?? undefined
      invariant(anchor)
      let range = Array.from(container.childNodes).slice(2)
      let last = container.childNodes[1]

      diffDom(container, moving + rest, {
        h: { a: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
      })

      expect(anchor.parentNode).toBe(null)
      expectNodeOrder(container.childNodes, [...range, last])
    })
  })

  describe('basic diffing', () => {
    it('diffs text nodes', () => {
      let container = document.createElement('div')
      container.innerHTML = 'Hello, world!'
      let text = container.firstChild
      invariant(text)

      diffDom(container, 'Goodbye, world!')

      expect(container.innerHTML).toBe('Goodbye, world!')
      expect(container.firstChild).toBe(text)
    })

    it('diffs element nodes', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div>Hello, world!</div>'
      let div = container.firstChild
      invariant(div)

      diffDom(container, '<div>Goodbye, world!</div>')

      expect(container.innerHTML).toBe('<div>Goodbye, world!</div>')
      expect(container.firstChild).toBe(div)
    })

    it('diffs element nodes with attributes', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div id="hello">Hello, world!</div>'
      let div = container.firstChild
      invariant(div)

      diffDom(container, '<div id="goodbye">Goodbye, world!</div>')

      expect(container.innerHTML).toBe('<div id="goodbye">Goodbye, world!</div>')
      expect(container.firstChild).toBe(div)
    })

    it('diffs children', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div><span>Hello, world!</span></div>'
      let div = container.firstChild
      invariant(div)
      let span = container.querySelector('span')
      invariant(span)

      diffDom(container, '<div><span>Goodbye, world!</span></div>')

      expect(container.innerHTML).toBe('<div><span>Goodbye, world!</span></div>')
      expect(container.firstChild).toBe(div)
      expect(container.querySelector('span')).toBe(span)
    })

    it('replaces children elements', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div><span>Hello, world!</span></div>'
      let div = container.firstChild
      invariant(div)

      diffDom(container, '<div><p>Goodbye, world!</p></div>')

      expect(container.innerHTML).toBe('<div><p>Goodbye, world!</p></div>')
      expect(container.firstChild).toBe(div)
    })

    it('retains focus when a following sibling changes element type', (t) => {
      let container = document.createElement('div')
      container.innerHTML = '<form><input></form><ul><li>Result</li></ul>'
      document.body.append(container)
      t.after(() => container.remove())
      let input = container.querySelector('input')
      invariant(input)
      input.focus()
      expect(document.activeElement).toBe(input)

      diffDom(container, '<form><input></form><p>No results</p>')

      expect(container.innerHTML).toBe('<form><input></form><p>No results</p>')
      expect(container.querySelector('input')).toBe(input)
      expect(document.activeElement).toBe(input)
    })
  })

  describe('comments', () => {
    it('retains focus in a live hydration range when a following sibling is removed', (t) => {
      let container = document.createElement('div')
      container.innerHTML =
        '<!-- rmx:h:old --><input><!-- /rmx:h --><button>Filter</button><a>Clear</a>'
      document.body.append(container)
      t.after(() => container.remove())
      let start = container.firstChild
      invariant(start instanceof Comment)
      attachClientEntryOwner(start)
      let input = container.querySelector('input')
      invariant(input)
      input.focus()
      expect(document.activeElement).toBe(input)

      diffDom(container, '<!-- rmx:h:new --><input><!-- /rmx:h --><button>Filter</button>', {
        h: {
          new: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} },
        },
      })

      expect(container.querySelector('a')).toBe(null)
      expect(container.querySelector('input')).toBe(input)
      expect(document.activeElement).toBe(input)
    })

    it('retains comments', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- start --><div>hello</div><!-- end -->'
      let comment = container.firstChild
      invariant(comment)

      diffDom(container, '<!-- start --><div>goodbye</div><!-- end -->')

      expect(container.innerHTML).toBe('<!-- start --><div>goodbye</div><!-- end -->')
      expect(container.firstChild).toBe(comment)
    })

    it('diffs comment data', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- a --><div>hello</div><!-- z -->'
      let first = container.firstChild
      let last = container.lastChild
      invariant(first && last)

      diffDom(container, '<!-- b --><div>hello</div><!-- y -->')

      expect(container.innerHTML).toBe('<!-- b --><div>hello</div><!-- y -->')
      expect(container.firstChild).toBe(first)
      expect(container.lastChild).toBe(last)
    })

    it('updates hydration marker ids while fast-forwarding boundaries', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:h:old --><button>Old</button><!-- /rmx:h -->'
      let start = container.firstChild
      invariant(start instanceof Comment)
      attachClientEntryOwner(start)

      diffDom(container, '<!-- rmx:h:new --><button>Old</button><!-- /rmx:h -->', {
        h: {
          old: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} },
          new: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} },
        },
      })

      expect(start.data.trim()).toBe('rmx:h:new')
      expect(container.firstChild).toBe(start)
    })

    it('preserves hydration ranges across HMR timestamped URLs', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:h:old --><input value="Stateful"><!-- /rmx:h -->'
      let start = container.firstChild
      invariant(start instanceof Comment)
      attachClientEntryOwner(start, undefined, {
        moduleUrl: '/entry.js?t=1234567890123',
        exportName: 'Entry',
      })

      diffDom(container, '<!-- rmx:h:new --><input value="Server"><!-- /rmx:h -->', {
        h: {
          new: {
            moduleUrl: '/entry.js?t=2234567890123',
            exportName: 'Entry',
            props: {},
          },
        },
      })

      expect(container.firstChild).toBe(start)
      expect(container.querySelector('input')?.value).toBe('Stateful')
    })

    it('does not treat short timestamp parameters as HMR versions', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:h:old --><input value="Stateful"><!-- /rmx:h -->'
      let oldStart = container.firstChild
      invariant(oldStart instanceof Comment)
      attachClientEntryOwner(oldStart, undefined, {
        moduleUrl: '/entry.js',
        exportName: 'Entry',
      })

      diffDom(container, '<!-- rmx:h:new --><input value="Server"><!-- /rmx:h -->', {
        h: {
          new: {
            moduleUrl: '/entry.js?t=1',
            exportName: 'Entry',
            props: {},
          },
        },
      })

      expect(container.firstChild).not.toBe(oldStart)
      expect(container.querySelector('input')?.value).toBe('Server')
    })

    it('does not treat long timestamp parameters as HMR versions', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:h:old --><input value="Stateful"><!-- /rmx:h -->'
      let oldStart = container.firstChild
      invariant(oldStart instanceof Comment)
      attachClientEntryOwner(oldStart, undefined, {
        moduleUrl: '/entry.js',
        exportName: 'Entry',
      })

      diffDom(container, '<!-- rmx:h:new --><input value="Server"><!-- /rmx:h -->', {
        h: {
          new: {
            moduleUrl: '/entry.js?t=12345678901234',
            exportName: 'Entry',
            props: {},
          },
        },
      })

      expect(container.firstChild).not.toBe(oldStart)
      expect(container.querySelector('input')?.value).toBe('Server')
    })

    it('preserves hydration ranges when HMR timestamps move around other search parameters', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:h:old --><input value="Stateful"><!-- /rmx:h -->'
      let start = container.firstChild
      invariant(start instanceof Comment)
      attachClientEntryOwner(start, undefined, {
        moduleUrl: '/entry.js?import&mode=compact&t=1234567890123#view',
        exportName: 'Entry',
      })

      diffDom(container, '<!-- rmx:h:new --><input value="Server"><!-- /rmx:h -->', {
        h: {
          new: {
            moduleUrl: '/entry.js?t=2234567890123&import&mode=compact#view',
            exportName: 'Entry',
            props: {},
          },
        },
      })

      expect(container.firstChild).toBe(start)
      expect(container.querySelector('input')?.value).toBe('Stateful')
    })

    it('compares non-HMR search parameters exactly', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:h:old --><input value="Stateful"><!-- /rmx:h -->'
      let oldStart = container.firstChild
      invariant(oldStart instanceof Comment)
      attachClientEntryOwner(oldStart, undefined, {
        moduleUrl: '/entry.js?import&mode=compact',
        exportName: 'Entry',
      })

      diffDom(container, '<!-- rmx:h:new --><input value="Server"><!-- /rmx:h -->', {
        h: {
          new: {
            moduleUrl: '/entry.js?import&mode=expanded&t=1234567890123',
            exportName: 'Entry',
            props: {},
          },
        },
      })

      expect(container.firstChild).not.toBe(oldStart)
      expect(container.querySelector('input')?.value).toBe('Server')
    })

    it('does not treat timestamps inside URL fragments as HMR versions', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:h:old --><input value="Stateful"><!-- /rmx:h -->'
      let oldStart = container.firstChild
      invariant(oldStart instanceof Comment)
      attachClientEntryOwner(oldStart, undefined, {
        moduleUrl: '/entry.js',
        exportName: 'Entry',
      })

      diffDom(container, '<!-- rmx:h:new --><input value="Server"><!-- /rmx:h -->', {
        h: {
          new: {
            moduleUrl: '/entry.js#view?t=1234567890123',
            exportName: 'Entry',
            props: {},
          },
        },
      })

      expect(container.firstChild).not.toBe(oldStart)
      expect(container.querySelector('input')?.value).toBe('Server')
    })

    it('replaces same-identity hydration ranges that do not have a live owner', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:h:old --><button>Old</button><!-- /rmx:h -->'
      let oldStart = container.firstChild

      diffDom(container, '<!-- rmx:h:new --><button>New</button><!-- /rmx:h -->', {
        h: {
          new: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} },
        },
      })

      expect(container.firstChild).not.toBe(oldStart)
      expect(container.querySelector('button')?.textContent).toBe('New')
    })

    it('replaces hydration ranges with different client entry identities', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:h:old --><button>Old</button><!-- /rmx:h -->'
      let oldStart = container.firstChild

      diffDom(container, '<!-- rmx:h:new --><button>New</button><!-- /rmx:h -->', {
        h: {
          old: { moduleUrl: '/old.js', exportName: 'Old', props: {} },
          new: { moduleUrl: '/new.js', exportName: 'New', props: {} },
        },
      })

      expect(container.firstChild).not.toBe(oldStart)
      expect(container.querySelector('button')?.textContent).toBe('New')
    })

    it('moves complete live hydration ranges when ordinary siblings shift', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<!-- rmx:h:old --><button>Stateful</button><!-- /rmx:h --><span>After</span>'
      let start = container.firstChild
      invariant(start instanceof Comment)
      attachClientEntryOwner(start)

      diffDom(
        container,
        '<p>Before</p><!-- rmx:h:new --><button>Server</button><!-- /rmx:h --><span>After</span>',
        {
          h: {
            new: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} },
          },
        },
      )

      expect(container.childNodes.item(1)).toBe(start)
      expect(start.data.trim()).toBe('rmx:h:new')
      expect(container.querySelector('button')?.textContent).toBe('Stateful')
    })

    it('keeps ordinary sibling state with its node when a hydration range moves', () => {
      let container = document.createElement('div')
      container.innerHTML = [
        '<input id="first" value="First">',
        '<input id="second" value="Second">',
        '<!-- rmx:h:old --><button>Stateful</button><!-- /rmx:h -->',
      ].join('')
      let first = container.querySelector('#first')
      let second = container.querySelector('#second')
      let start = container.childNodes.item(2)
      invariant(first instanceof HTMLInputElement)
      invariant(second instanceof HTMLInputElement)
      invariant(start instanceof Comment)
      first.value = 'Edited first'
      second.value = 'Edited second'
      attachClientEntryOwner(start)

      diffDom(
        container,
        [
          '<!-- rmx:h:new --><button>Server</button><!-- /rmx:h -->',
          '<input id="first" value="First">',
          '<input id="second" value="Second">',
        ].join(''),
        {
          h: {
            new: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} },
          },
        },
      )

      expect(container.querySelector('#first')).toBe(first)
      expect(container.querySelector('#second')).toBe(second)
      expect(first.value).toBe('Edited first')
      expect(second.value).toBe('Edited second')
    })

    it('pairs repeated live hydration ranges by identity in source order', () => {
      let container = document.createElement('div')
      container.innerHTML = [
        '<!-- rmx:h:first --><button>First</button><!-- /rmx:h -->',
        '<!-- rmx:h:second --><button>Second</button><!-- /rmx:h -->',
      ].join('')
      let firstStart = container.childNodes.item(0)
      let secondStart = container.childNodes.item(3)
      invariant(firstStart instanceof Comment)
      invariant(secondStart instanceof Comment)
      let firstDisposeCount = 0
      let secondDisposeCount = 0
      attachClientEntryOwner(firstStart, () => {
        firstDisposeCount++
      })
      attachClientEntryOwner(secondStart, () => {
        secondDisposeCount++
      })

      diffDom(container, '<!-- rmx:h:next --><button>Server</button><!-- /rmx:h -->', {
        h: {
          next: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} },
        },
      })

      expect(container.firstChild).toBe(firstStart)
      expect(secondStart.parentNode).toBeNull()
      expect(container.querySelector('button')?.textContent).toBe('First')
      expect(firstDisposeCount).toBe(0)
      expect(secondDisposeCount).toBe(1)
    })

    it('keeps a user key distinct from a client entry with the same identity text', () => {
      let container = document.createElement('div')
      let key = JSON.stringify(['/entry.js', 'Entry'])
      let keyed = `<button data-rmx-key='${key}'>Keyed</button>`
      container.innerHTML = `<!-- rmx:h:one --><input><!-- /rmx:h -->${keyed}`
      let start = container.firstChild
      invariant(start instanceof Comment)
      attachClientEntryOwner(start)
      let input = container.querySelector('input')
      let button = container.querySelector('button')

      diffDom(container, `${keyed}<!-- rmx:h:two --><input><!-- /rmx:h -->`, {
        h: { two: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
      })

      expect(container.firstChild).toBe(button)
      expect(button?.nextSibling).toBe(start)
      expect(container.querySelector('input')).toBe(input)
    })

    it('rechecks an entry whose owner changes while an earlier sibling updates', (t) => {
      let container = document.createElement('div')
      container.innerHTML = '<b></b><!-- rmx:h:old --><input><!-- /rmx:h -->'
      let start = container.childNodes[1]
      invariant(start instanceof Comment)
      attachClientEntryOwner(start)
      let first = container.firstElementChild!
      let oldInput = container.querySelector('input')
      let set = first.setAttribute.bind(first)
      let disposals = 0
      t.mock.method(first, 'setAttribute', (name: string, value: string) => {
        set(name, value)
        attachClientEntryOwner(start, () => disposals++, {
          moduleUrl: '/different.js',
          exportName: 'Entry',
        })
      })

      diffDom(container, '<b title="updated"></b><!-- rmx:h:new --><input><!-- /rmx:h -->', {
        h: { new: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} } },
      })

      expect(start.parentNode).toBeNull()
      expect(container.querySelector('input')).not.toBe(oldInput)
      expect(disposals).toBe(1)
    })

    it('does not let an unmatched boundary consume a later semantic match', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:h:current --><button>Stateful</button><!-- /rmx:h -->'
      let currentStart = container.firstChild
      invariant(currentStart instanceof Comment)
      let disposeCount = 0
      attachClientEntryOwner(currentStart, () => {
        disposeCount++
      })

      diffDom(
        container,
        [
          '<!-- rmx:h:inserted --><button>Inserted</button><!-- /rmx:h -->',
          '<!-- rmx:h:preserved --><button>Server</button><!-- /rmx:h -->',
        ].join(''),
        {
          h: {
            inserted: { moduleUrl: '/other.js', exportName: 'Other', props: {} },
            preserved: { moduleUrl: '/entry.js', exportName: 'Entry', props: {} },
          },
        },
      )

      expect(container.childNodes.item(3)).toBe(currentStart)
      expect(currentStart.data.trim()).toBe('rmx:h:preserved')
      expect(container.querySelectorAll('button').item(1).textContent).toBe('Stateful')
      expect(disposeCount).toBe(0)
    })

    it('keeps generated boundary lists balanced with exact ordinary destination DOM', () => {
      let identities: ClientEntryIdentity[] = [
        { moduleUrl: '/a.js', exportName: 'Entry' },
        { moduleUrl: '/b.js', exportName: 'Entry' },
        { moduleUrl: '/b.js', exportName: 'Other' },
      ]

      for (let seed = 0; seed < 24; seed++) {
        let host = document.createElement('div')
        let current = document.createElement('div')
        let next = document.createElement('div')
        host.appendChild(current)
        let disposeCounts: number[] = []
        let currentCount = (seed % 4) + 1
        let nextCount = ((seed * 3) % 5) + 1

        for (let i = 0; i < currentCount; i++) {
          if ((seed + i) % 2 === 0) {
            let ordinary = document.createElement('span')
            ordinary.setAttribute('data-source', `${seed}-${i}`)
            current.appendChild(ordinary)
          }

          let start = document.createComment(`rmx:h:current-${seed}-${i}`)
          let content = document.createElement('button')
          content.textContent = `Current ${seed}-${i}`
          let end = document.createComment('/rmx:h')
          current.append(start, content, end)

          disposeCounts.push(0)
          let disposeIndex = disposeCounts.length - 1
          attachClientEntryOwner(
            start,
            () => {
              disposeCounts[disposeIndex]++
            },
            identities[(seed + i) % identities.length],
          )
        }

        let hydrationData: NonNullable<FrameContext['data']['h']> = {}
        let data: FrameContext['data'] = { h: hydrationData }
        let expectedOrdinaryIds: string[] = []
        for (let i = 0; i < nextCount; i++) {
          if ((seed + i) % 3 !== 0) {
            let id = `${seed}-${i}`
            let ordinary = document.createElement('span')
            ordinary.setAttribute('data-destination', id)
            next.appendChild(ordinary)
            expectedOrdinaryIds.push(id)
          }

          let id = `next-${seed}-${i}`
          let identity = identities[(seed * 2 + i) % identities.length]
          let start = document.createComment(`rmx:h:${id}`)
          let content = document.createElement('button')
          content.textContent = `Next ${seed}-${i}`
          let end = document.createComment('/rmx:h')
          next.append(start, content, end)
          hydrationData[id] = { ...identity, props: {} }
        }

        diffDomNodes([current], [next], data)

        let comments = Array.from(current.childNodes).filter(
          (node): node is Comment => node instanceof Comment,
        )
        let starts = comments.filter((comment) => comment.data.trim().startsWith('rmx:h:'))
        let ends = comments.filter((comment) => comment.data.trim() === '/rmx:h')
        let ordinaryIds = Array.from(current.querySelectorAll('[data-destination]')).map(
          (element) => element.getAttribute('data-destination') ?? '',
        )

        expect(starts).toHaveLength(nextCount)
        expect(ends).toHaveLength(nextCount)
        expect(ordinaryIds).toEqual(expectedOrdinaryIds)
        expect(disposeCounts.every((count) => count === 0 || count === 1)).toBe(true)
      }
    })

    it('does not match keyed elements owned by nested hydration ranges', () => {
      let container = document.createElement('div')
      let current = document.createElement('div')
      container.appendChild(current)

      let outerStart = document.createComment('rmx:h:outer')
      let innerStart = document.createComment('rmx:h:inner')
      let innerContent = document.createElement('span')
      let innerEnd = document.createComment('/rmx:h')
      let owned = document.createElement('section')
      let outerEnd = document.createComment('/rmx:h')
      let dataKey = 'data-rmx-key'
      owned.setAttribute(dataKey, 'entry')
      current.append(outerStart, innerStart, innerContent, innerEnd, owned, outerEnd)

      let disposeCount = 0
      attachClientEntryOwner(outerStart, () => {
        disposeCount++
        owned.remove()
      })

      let next = document.createElement('div')
      let replacement = document.createElement('section')
      replacement.id = 'replacement'
      replacement.setAttribute(dataKey, 'entry')
      next.appendChild(replacement)

      diffDomNodes([current], [next])

      expect(current.childNodes).toHaveLength(1)
      expect(current.firstChild).toBe(replacement)
      expect(disposeCount).toBe(1)
    })

    it('does not match frame end markers owned by hydration ranges', () => {
      let container = document.createElement('div')
      let current = document.createElement('div')
      container.appendChild(current)

      let hydrationStart = document.createComment('rmx:h:entry')
      let currentFrameStart = document.createComment('rmx:f:current')
      let currentFrameContent = document.createElement('p')
      let currentFrameEnd = document.createComment('/rmx:f')
      let hydrationEnd = document.createComment('/rmx:h')
      current.append(
        hydrationStart,
        currentFrameStart,
        currentFrameContent,
        currentFrameEnd,
        hydrationEnd,
      )

      let disposeCount = 0
      attachClientEntryOwner(hydrationStart, () => {
        disposeCount++
        let range = document.createRange()
        range.setStartBefore(currentFrameStart)
        range.setEndAfter(currentFrameEnd)
        range.deleteContents()
      })

      let next = document.createElement('div')
      let nextFrameStart = document.createComment('rmx:f:next')
      let nextFrameContent = document.createElement('section')
      let nextFrameEnd = document.createComment('/rmx:f')
      next.append(nextFrameStart, nextFrameContent, nextFrameEnd)

      diffDomNodes([current], [next])

      expect(current.childNodes).toHaveLength(3)
      expect(current.childNodes.item(0)).toBe(nextFrameStart)
      expect(current.childNodes.item(1)).toBe(nextFrameContent)
      expect(current.childNodes.item(2)).toBe(nextFrameEnd)
      expect(disposeCount).toBe(1)
    })

    it('does not match a shifted frame start with the current frame end', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div><i></i><!-- rmx:f:f00000000 --><b></b><!-- /rmx:f --></div>'

      let root = container.firstElementChild
      invariant(root)
      let currentFrameEnd = root.childNodes.item(3)
      invariant(currentFrameEnd instanceof Comment)

      let next = '<div><i></i><u></u><b></b><!-- rmx:f:f11111111 --><b></b><!-- /rmx:f --></div>'

      // The inserted siblings shift the incoming frame start to the current frame end's index.
      diffDom(container, next)

      expect(root.childNodes.item(3)).not.toBe(currentFrameEnd)
      expect(currentFrameEnd.parentNode).toBeNull()
      expect(root.outerHTML).toBe(next)
    })

    it('preserves resolved frame content when a pending marker reuses the same id', () => {
      let container = document.createElement('div')
      container.innerHTML = '<!-- rmx:f:same --><p>Resolved current</p><!-- /rmx:f -->'
      let start = container.firstChild
      invariant(start instanceof Comment)
      let renderCount = 0
      let frameInstances = new WeakMap<Comment, TestFrame>()
      frameInstances.set(start, {
        dispose() {},
        isDisplayingResolvedContent: () => true,
        identity: { src: '/same' },
        async renderMarkerContent() {
          renderCount++
        },
      })

      diffDom(
        container,
        '<!-- rmx:f:same --><p>Pending fallback</p><!-- /rmx:f -->',
        {
          f: {
            same: { src: '/same', status: 'pending' },
          },
        },
        frameInstances,
      )

      expect(container.firstChild).toBe(start)
      expect(container.querySelector('p')?.textContent).toBe('Resolved current')
      expect(renderCount).toBe(0)
    })
  })

  describe('keyed diffs', () => {
    it('retains keyed elements via data-rmx-key', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<ul><li data-rmx-key="a">A</li><li data-rmx-key="b">B</li><li data-rmx-key="c">C</li></ul>'
      let list = container.querySelector('ul')
      invariant(list)

      let a = list.children.item(0)
      let b = list.children.item(1)
      let c = list.children.item(2)
      invariant(a && b && c)

      diffDom(
        container,
        '<ul><li data-rmx-key="b">B</li><li data-rmx-key="a">A</li><li data-rmx-key="c">C</li></ul>',
      )

      let updatedList = container.querySelector('ul')
      invariant(updatedList)
      expect(updatedList.children.item(0)).toBe(b)
      expect(updatedList.children.item(1)).toBe(a)
      expect(updatedList.children.item(2)).toBe(c)
      expect(updatedList.innerHTML).toBe(
        '<li data-rmx-key="b">B</li><li data-rmx-key="a">A</li><li data-rmx-key="c">C</li>',
      )
    })

    it('does not move a keyed element when a sibling is added before it', () => {
      let container = document.createElement('div')
      container.innerHTML = '<p>Intro</p><iframe data-rmx-key="video"></iframe><p>Footer</p>'
      let iframe = container.querySelector('iframe')
      invariant(iframe)
      let mutations = recordMutations(container)

      diffDom(
        container,
        '<p>Notice</p><p>Intro</p><iframe data-rmx-key="video"></iframe><p>Footer</p>',
      )

      expect(container.innerHTML).toBe(
        '<p>Notice</p><p>Intro</p><iframe data-rmx-key="video"></iframe><p>Footer</p>',
      )
      expect(container.querySelector('iframe')).toBe(iframe)
      expect(mutations().removed).not.toContain(iframe)
    })

    it('moves only the displaced keyed element when keyed siblings rotate', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<ul><li data-rmx-key="a">A</li><li data-rmx-key="b">B</li><li data-rmx-key="c">C</li><li data-rmx-key="d">D</li></ul>'
      let list = container.querySelector('ul')
      invariant(list)
      let d = list.children.item(3)
      invariant(d)
      let mutations = recordMutations(list)

      diffDom(
        container,
        '<ul><li data-rmx-key="d">D</li><li data-rmx-key="a">A</li><li data-rmx-key="b">B</li><li data-rmx-key="c">C</li></ul>',
      )

      expect(Array.from(list.children, (item) => item.textContent)).toEqual(['D', 'A', 'B', 'C'])
      let { removed } = mutations()
      expect(removed.length).toBe(1)
      expect(removed[0]).toBe(d)
    })
  })

  describe('head', () => {
    it('does not move a keyed stylesheet when a link is added before it', () => {
      let current = parseHead(
        '<link data-rmx-key="styles" rel="stylesheet" href="/app.css">' +
          '<link rel="modulepreload" href="/a.js">',
      )
      let [styles, preload] = Array.from(current.head.children)
      let mutations = recordMutations(current.head)

      diffHead(
        current,
        '<link rel="alternate" type="text/markdown" href="/b.md">' +
          '<link data-rmx-key="styles" rel="stylesheet" href="/app.css">' +
          '<link rel="modulepreload" href="/a.js">',
      )

      expect(current.head.innerHTML).toBe(
        '<link rel="alternate" type="text/markdown" href="/b.md">' +
          '<link data-rmx-key="styles" rel="stylesheet" href="/app.css">' +
          '<link rel="modulepreload" href="/a.js">',
      )
      let { removed, attributeTargets } = mutations()
      expect(removed).not.toContain(styles)
      expect(attributeTargets).not.toContain(preload)
      expect(current.head.children.item(2)).toBe(preload)
    })

    it('does not repurpose a link to load a different href', () => {
      let current = parseHead(
        '<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/b.css">',
      )
      let [a, b] = Array.from(current.head.children)
      let mutations = recordMutations(current.head)

      diffHead(
        current,
        '<link rel="stylesheet" href="/page.css">' +
          '<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/b.css">',
      )

      expect(current.head.innerHTML).toBe(
        '<link rel="stylesheet" href="/page.css">' +
          '<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/b.css">',
      )
      expect(current.head.children.item(1)).toBe(a)
      expect(current.head.children.item(2)).toBe(b)
      let { removed, attributeTargets } = mutations()
      expect(removed).toEqual([])
      expect(attributeTargets).toEqual([])
    })

    it('does not move a keyed stylesheet when a preserved node trails the head', () => {
      let current = parseHead(
        '<link data-rmx-key="styles" rel="stylesheet" href="/app.css">' +
          '<link rel="modulepreload" href="/a.js">' +
          '<link rel="prefetch" href="/next">',
      )
      let [styles, preload, prefetch] = Array.from(current.head.children)
      let mutations = recordMutations(current.head)

      diffHead(
        current,
        '<link rel="alternate" type="text/markdown" href="/b.md">' +
          '<link data-rmx-key="styles" rel="stylesheet" href="/app.css">' +
          '<link rel="modulepreload" href="/a.js">',
        (node) => node === prefetch,
      )

      expect(current.head.children.length).toBe(4)
      expect(current.head.children.item(1)).toBe(styles)
      expect(current.head.children.item(2)).toBe(preload)
      expect(current.head.children.item(3)).toBe(prefetch)
      expect(mutations().removed).not.toContain(styles)
    })
  })

  describe('live browser state', () => {
    it('preserves current details open state when incoming html removes open', () => {
      let container = document.createElement('div')
      container.innerHTML = '<details open><summary>Toggle</summary><p>Body</p></details>'
      let details = container.querySelector('details')
      invariant(details)

      diffDom(container, '<details><summary>Toggle</summary><p>Body</p></details>')

      expect(details.open).toBe(true)
      expect(details.hasAttribute('open')).toBe(true)
    })

    it('preserves current dialog open state when incoming html removes open', () => {
      let container = document.createElement('div')
      container.innerHTML = '<dialog open>Hello</dialog>'
      let dialog = container.querySelector('dialog')
      invariant(dialog)

      diffDom(container, '<dialog>Hello</dialog>')

      expect(dialog.open).toBe(true)
      expect(dialog.hasAttribute('open')).toBe(true)
    })

    it('preserves current input checked state when incoming html removes checked', () => {
      let container = document.createElement('div')
      container.innerHTML = '<input type="checkbox" checked>'
      let input = container.querySelector('input')
      invariant(input)

      diffDom(container, '<input type="checkbox">')

      expect(input.checked).toBe(true)
      expect(input.hasAttribute('checked')).toBe(true)
    })

    it('preserves current input value when incoming html changes value', () => {
      let container = document.createElement('div')
      container.innerHTML = '<input value="server">'
      let input = container.querySelector('input')
      invariant(input)
      input.value = 'user'

      diffDom(container, '<input value="server-next">')

      expect(input.value).toBe('user')
      expect(input.getAttribute('value')).toBe('server')
    })

    it('does not carry typed input into a different field when siblings reorder', () => {
      let container = document.createElement('div')
      container.innerHTML = '<input name="email"><p>Hint</p>'
      let input = container.querySelector('input')
      invariant(input)
      input.value = 'user@example.com'

      diffDom(container, '<p>Hint</p><input name="search">')

      let nextInput = container.querySelector('input')
      invariant(nextInput)
      expect(nextInput).not.toBe(input)
      expect(nextInput.name).toBe('search')
      expect(nextInput.value).toBe('')
    })

    it('preserves current textarea value when incoming html changes its text', () => {
      let container = document.createElement('div')
      container.innerHTML = '<textarea>server</textarea>'
      let textarea = container.querySelector('textarea')
      invariant(textarea)
      textarea.value = 'user'

      diffDom(container, '<textarea>server-next</textarea>')

      expect(textarea.value).toBe('user')
      expect(textarea.textContent).toBe('server')
    })

    it('removes client-added element children when incoming html has none', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div></div>'
      let div = container.querySelector('div')
      invariant(div)

      let button = document.createElement('button')
      button.textContent = 'Search'
      div.append(button)

      diffDom(container, '<div></div>')

      expect(container.firstElementChild).toBe(div)
      expect(div.firstElementChild).toBeNull()
      expect(button.isConnected).toBe(false)
    })

    it('preserves data-rmx-preserve-dom element attributes and children', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<div data-rmx-preserve-dom data-state="client"><button>Client</button></div>'
      let div = container.querySelector('div')
      invariant(div)
      let button = div.querySelector('button')
      invariant(button)

      diffDom(container, '<div data-rmx-preserve-dom data-state="server"><span>Server</span></div>')

      expect(container.firstElementChild).toBe(div)
      expect(div.getAttribute('data-state')).toBe('client')
      expect(div.firstElementChild).toBe(button)
      expect(div.innerHTML).toBe('<button>Client</button>')
    })

    it('preserves named attributes while reconciling other attributes and children', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<div class="layout" data-theme="light" title="Old" data-page="old"><p>Old</p></div>'
      let div = container.querySelector('div')
      invariant(div)
      div.classList.add('dark')
      div.setAttribute('data-theme', 'dark')

      diffDom(
        container,
        '<div data-rmx-preserve-attrs=" class\tdata-theme\nclass " class="new-layout" title="New" lang="en"><p>New</p></div>',
      )

      expect(container.firstElementChild).toBe(div)
      expect(div.className).toBe('layout dark')
      expect(div.getAttribute('data-theme')).toBe('dark')
      expect(div.getAttribute('title')).toBe('New')
      expect(div.getAttribute('lang')).toBe('en')
      expect(div.hasAttribute('data-page')).toBe(false)
      expect(div.innerHTML).toBe('<p>New</p>')
    })

    it('preserves the absence of attributes removed by client code', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div class="dark" data-theme="dark"></div>'
      let div = container.querySelector('div')
      invariant(div)
      div.removeAttribute('class')
      div.removeAttribute('data-theme')

      diffDom(
        container,
        '<div data-rmx-preserve-attrs="class data-theme" class="dark" data-theme="dark"></div>',
      )

      expect(div.hasAttribute('class')).toBe(false)
      expect(div.hasAttribute('data-theme')).toBe(false)
    })

    it('uses the incoming preservation list when ownership changes', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<div data-rmx-preserve-attrs="class data-theme" class="dark" data-theme="dark"></div>'
      let div = container.querySelector('div')
      invariant(div)

      diffDom(
        container,
        '<div data-rmx-preserve-attrs="data-theme" class="light" data-theme="light"></div>',
      )

      expect(div.className).toBe('light')
      expect(div.getAttribute('data-theme')).toBe('dark')
      expect(div.getAttribute('data-rmx-preserve-attrs')).toBe('data-theme')
    })

    it('returns attributes to normal reconciliation when the preservation list is empty', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<div data-rmx-preserve-attrs="class data-theme" class="dark" data-theme="dark"></div>'
      let div = container.querySelector('div')
      invariant(div)

      diffDom(container, '<div data-rmx-preserve-attrs="" class="light"></div>')

      expect(div.className).toBe('light')
      expect(div.hasAttribute('data-theme')).toBe(false)
      expect(div.getAttribute('data-rmx-preserve-attrs')).toBe('')
    })

    it('returns attributes to normal reconciliation when the preservation list is omitted', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<div data-rmx-preserve-attrs="class data-theme" class="dark" data-theme="dark"></div>'
      let div = container.querySelector('div')
      invariant(div)

      diffDom(container, '<div data-theme="light"></div>')

      expect(div.hasAttribute('class')).toBe(false)
      expect(div.getAttribute('data-theme')).toBe('light')
      expect(div.hasAttribute('data-rmx-preserve-attrs')).toBe(false)
    })

    it('preserves named SVG attributes without changing their case', () => {
      let container = document.createElement('div')
      container.innerHTML = '<svg viewBox="0 0 10 10"><circle r="2"></circle></svg>'
      let svg = container.querySelector('svg')
      invariant(svg)
      svg.setAttribute('viewBox', '0 0 20 20')

      diffDom(
        container,
        '<svg data-rmx-preserve-attrs="viewBox" viewBox="0 0 10 10"><circle r="4"></circle></svg>',
      )

      expect(svg.getAttribute('viewBox')).toBe('0 0 20 20')
      expect(svg.querySelector('circle')?.getAttribute('r')).toBe('4')
    })

    it('does not preserve descendants with an attribute preservation list', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div class="dark"><span class="old">Old</span></div>'
      let div = container.querySelector('div')
      invariant(div)

      diffDom(
        container,
        '<div data-rmx-preserve-attrs="class" class="light"><span class="new">New</span></div>',
      )

      expect(div.className).toBe('dark')
      expect(div.innerHTML).toBe('<span class="new">New</span>')
    })

    it('can replace and remove elements with preserved attributes', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div data-rmx-preserve-attrs="class" class="dark">Old</div>'
      let div = container.querySelector('div')
      invariant(div)

      diffDom(container, '<section data-rmx-preserve-attrs="class" class="light">New</section>')

      expect(container.contains(div)).toBe(false)
      expect(container.firstElementChild?.getAttribute('class')).toBe('light')
      expect(container.textContent).toBe('New')

      diffDom(container, '')

      expect(container.childNodes).toHaveLength(0)
    })

    it('preserves the whole DOM when both preservation attributes are present', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div class="dark" data-theme="dark"><p>Client</p></div>'
      let div = container.querySelector('div')
      invariant(div)

      diffDom(
        container,
        '<div data-rmx-preserve-dom data-rmx-preserve-attrs="class" class="light" data-theme="light"><p>Server</p></div>',
      )

      expect(div.className).toBe('dark')
      expect(div.getAttribute('data-theme')).toBe('dark')
      expect(div.innerHTML).toBe('<p>Client</p>')
    })

    it('preserves data-rmx-preserve-dom custom element children added during initialization', () => {
      let tagName = 'mock-pagefind-modal-trigger-lifecycle'
      if (!customElements.get(tagName)) {
        customElements.define(
          tagName,
          class MockPagefindModalTrigger extends HTMLElement {
            #initialized = false

            connectedCallback() {
              if (this.#initialized) return
              this.#initialized = true

              this.innerHTML = ''
              let button = document.createElement('button')
              button.type = 'button'
              button.className = 'pf-trigger-btn'
              button.textContent = 'Search'
              this.appendChild(button)
            }

            disconnectedCallback() {
              this.#initialized = false
            }
          },
        )
      }

      let container = document.createElement('div')
      document.body.appendChild(container)

      try {
        let trigger = document.createElement(tagName)
        container.appendChild(trigger)
        let button = trigger.querySelector('button')
        invariant(button)

        diffDom(container, `<${tagName} data-rmx-preserve-dom></${tagName}>`)

        expect(container.firstElementChild).toBe(trigger)
        expect(trigger.hasAttribute('data-rmx-preserve-dom')).toBe(true)
        expect(trigger.querySelector('button')).toBe(button)
        expect(button.isConnected).toBe(true)
      } finally {
        container.remove()
      }
    })

    it('can pair data-rmx-preserve-dom elements with data-rmx-key before index fallback moves them', () => {
      let tagName = 'mock-pagefind-modal-lifecycle'
      let connects = 0
      let disconnects = 0

      if (!customElements.get(tagName)) {
        customElements.define(
          tagName,
          class MockPagefindModal extends HTMLElement {
            connectedCallback() {
              connects++
            }

            disconnectedCallback() {
              disconnects++
            }
          },
        )
      }

      let container = document.createElement('div')
      document.body.appendChild(container)

      try {
        container.innerHTML = `<section><span>Old</span><${tagName} data-rmx-key="modal" data-rmx-preserve-dom><dialog>Client</dialog></${tagName}></section>`
        let modal = container.querySelector(tagName)
        invariant(modal)
        let dialog = modal.querySelector('dialog')
        invariant(dialog)
        connects = 0
        disconnects = 0

        diffDom(
          container,
          `<section><span>New</span><p>Inserted</p><${tagName} data-rmx-key="modal" data-rmx-preserve-dom></${tagName}></section>`,
        )

        expect(container.querySelector(tagName)).toBe(modal)
        expect(modal.querySelector('dialog')).toBe(dialog)
        expect(modal.innerHTML).toBe('<dialog>Client</dialog>')
        expect(connects).toBe(0)
        expect(disconnects).toBe(0)
      } finally {
        container.remove()
      }
    })

    it('does not reconnect keyed data-rmx-preserve-dom elements during reordering', () => {
      let tagName = 'mock-pagefind-modal-stationary'
      let connects = 0
      let disconnects = 0

      if (!customElements.get(tagName)) {
        customElements.define(
          tagName,
          class MockPagefindModal extends HTMLElement {
            connectedCallback() {
              connects++
            }

            disconnectedCallback() {
              disconnects++
            }
          },
        )
      }

      let container = document.createElement('div')
      document.body.appendChild(container)

      try {
        container.innerHTML = `<section><${tagName} data-rmx-key="modal" data-rmx-preserve-dom><dialog>Client</dialog></${tagName}><p data-rmx-key="a">A</p><p data-rmx-key="b">B</p></section>`
        let section = container.querySelector('section')
        invariant(section)
        let [modal, a, b] = Array.from(section.children)
        let dialog = modal.querySelector('dialog')
        invariant(dialog)
        connects = 0
        disconnects = 0

        diffDom(
          container,
          `<section><p data-rmx-key="a">A</p><p data-rmx-key="b">B</p><${tagName} data-rmx-key="modal" data-rmx-preserve-dom></${tagName}></section>`,
        )

        expect(Array.from(section.children)).toEqual([a, b, modal])
        expect(modal.querySelector('dialog')).toBe(dialog)
        expect(connects).toBe(0)
        expect(disconnects).toBe(0)
      } finally {
        container.remove()
      }
    })

    it('moves siblings across multiple preserved DOM elements without detaching them', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<div data-rmx-key="first" data-rmx-preserve-dom></div>' +
        '<p data-rmx-key="a">A</p><p data-rmx-key="b">B</p>' +
        '<div data-rmx-key="second" data-rmx-preserve-dom></div>' +
        '<p data-rmx-key="c">C</p><p data-rmx-key="d">D</p>'
      let [first, a, b, second, c, d] = Array.from(container.children)
      let mutations = recordMutations(container)

      diffDom(
        container,
        '<p data-rmx-key="c">C</p>' +
          '<div data-rmx-key="first" data-rmx-preserve-dom></div>' +
          '<div data-rmx-key="second" data-rmx-preserve-dom></div>' +
          '<p data-rmx-key="a">A</p><p data-rmx-key="b">B</p><p data-rmx-key="d">D</p>',
      )

      expect(Array.from(container.children)).toEqual([c, first, second, a, b, d])
      let { removed } = mutations()
      expect(removed).not.toContain(first)
      expect(removed).not.toContain(second)
    })

    it('minimizes sibling moves between preserved DOM elements', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<div data-rmx-key="first" data-rmx-preserve-dom></div>' +
        '<p data-rmx-key="a">A</p><p data-rmx-key="b">B</p>' +
        '<p data-rmx-key="c">C</p><p data-rmx-key="d">D</p>' +
        '<div data-rmx-key="last" data-rmx-preserve-dom></div>'
      let [first, a, b, c, d, last] = Array.from(container.children)
      let mutations = recordMutations(container)

      diffDom(
        container,
        '<div data-rmx-key="first" data-rmx-preserve-dom></div>' +
          '<p data-rmx-key="d">D</p><p data-rmx-key="a">A</p>' +
          '<p data-rmx-key="b">B</p><p data-rmx-key="c">C</p>' +
          '<div data-rmx-key="last" data-rmx-preserve-dom></div>',
      )

      expect(Array.from(container.children)).toEqual([first, d, a, b, c, last])
      expect(mutations().removed).toEqual([d])
    })

    it('preserves current select value when incoming html changes selected options', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<select><option value="a">A</option><option value="b">B</option></select>'
      let select = container.querySelector('select')
      invariant(select)
      let first = select.options.item(0)
      let second = select.options.item(1)
      invariant(first && second)
      select.value = 'b'

      diffDom(
        container,
        '<select><option value="a" selected>A</option><option value="b">B</option></select>',
      )

      expect(select.value).toBe('b')
      expect(first.selected).toBe(false)
      expect(second.selected).toBe(true)
      expect(first.hasAttribute('selected')).toBe(false)
    })

    it('preserves current popover visibility when incoming html removes popover', () => {
      let container = document.createElement('div')
      container.innerHTML = '<div popover="auto">Hello</div>'
      let popover = container.querySelector('div')
      invariant(popover)
      document.body.appendChild(container)

      try {
        expect(typeof popover.showPopover).toBe('function')
        popover.showPopover()

        diffDom(container, '<div>Hello</div>')

        expect(popover.matches(':popover-open')).toBe(true)
        expect(popover.getAttribute('popover')).toBe('auto')
      } finally {
        container.remove()
      }
    })
  })
})
