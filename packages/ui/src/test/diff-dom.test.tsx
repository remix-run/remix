import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../runtime/invariant.ts'
import { diffNodes } from '../runtime/diff-dom.ts'

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
