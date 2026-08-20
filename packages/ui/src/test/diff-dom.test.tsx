import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../runtime/invariant.ts'
import { diffNodes } from '../runtime/diff-dom.ts'
import type { FrameContext } from '../runtime/frame.ts'
import {
  setClientEntryBoundaryOwner,
  type ClientEntryIdentity,
} from '../runtime/client-entry-boundary.ts'

function attachClientEntryOwner(
  marker: Comment,
  onDispose = () => {},
  identity: ClientEntryIdentity = { moduleUrl: '/entry.js', exportName: 'Entry' },
): void {
  setClientEntryBoundaryOwner(marker, identity, { dispose: onDispose, render() {} })
}

function diffDomNodes(current: Node[], next: Node[], data: FrameContext['data'] = {}) {
  diffNodes(current, next, {
    frameInstances: new WeakMap(),
    pendingClientEntries: new Map(),
    data,
  } as any)
}

type TestFrame = {
  dispose(): void
  isDisplayingResolvedContent(): boolean
  matchesIdentity(src: string, name: string | undefined): boolean
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
    frameInstances,
    pendingClientEntries: new Map(),
    data: data ?? {},
  } as any)
}

describe('diffNodes', () => {
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
  })

  describe('comments', () => {
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
        matchesIdentity: (src, name) => src === '/same' && name === undefined,
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
        container.innerHTML = `<section><${tagName} data-rmx-key="modal" data-rmx-preserve-dom><dialog>Client</dialog></${tagName}><p>Old</p></section>`
        let modal = container.querySelector(tagName)
        invariant(modal)
        let dialog = modal.querySelector('dialog')
        invariant(dialog)
        connects = 0
        disconnects = 0

        diffDom(
          container,
          `<section><p>New</p><${tagName} data-rmx-key="modal" data-rmx-preserve-dom></${tagName}></section>`,
        )

        expect(container.querySelector(tagName)).toBe(modal)
        expect(modal.querySelector('dialog')).toBe(dialog)
        expect(connects).toBe(0)
        expect(disconnects).toBe(0)
      } finally {
        container.remove()
      }
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
