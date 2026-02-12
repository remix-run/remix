import { describe, it, expect } from 'vitest'
import { invariant } from '../lib/invariant.ts'
import { diffNodes } from '../lib/diff-dom.ts'

function diffDom(container: HTMLElement, next: string) {
  let template = document.createElement('template')
  template.innerHTML = next

  diffNodes(Array.from(container.childNodes), Array.from(template.content.childNodes), {
    pendingClientEntries: new Map(),
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

      diffDom(container, '<!-- rmx:h:new --><button>Old</button><!-- /rmx:h -->')

      let start = container.firstChild
      invariant(start && start.nodeType === Node.COMMENT_NODE)
      expect((start as Comment).data.trim()).toBe('rmx:h:new')
    })
  })

  describe('keyed diffs', () => {
    it('retains keyed elements via data-key', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<ul><li data-key="a">A</li><li data-key="b">B</li><li data-key="c">C</li></ul>'
      let list = container.querySelector('ul')
      invariant(list)

      let a = list.children.item(0)
      let b = list.children.item(1)
      let c = list.children.item(2)
      invariant(a && b && c)

      diffDom(
        container,
        '<ul><li data-key="b">B</li><li data-key="a">A</li><li data-key="c">C</li></ul>',
      )

      let updatedList = container.querySelector('ul')
      invariant(updatedList)
      expect(updatedList.children.item(0)).toBe(b)
      expect(updatedList.children.item(1)).toBe(a)
      expect(updatedList.children.item(2)).toBe(c)
      expect(updatedList.innerHTML).toBe(
        '<li data-key="b">B</li><li data-key="a">A</li><li data-key="c">C</li>',
      )
    })
  })
})
