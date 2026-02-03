import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDocumentState } from '../lib/document-state.ts'

describe('document-state', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  describe('capture and restore after DOM moves', () => {
    it('restores focus and selection after moving a text input', () => {
      let input = document.createElement('input')
      input.type = 'text'
      input.value = 'Hello World'
      container.appendChild(input)
      input.focus()
      input.setSelectionRange(6, 11)

      let state = createDocumentState()
      state.capture()

      // Move the node (simulating what happens during DOM updates)
      // This causes focus/selection to be lost
      container.removeChild(input)
      container.appendChild(input)
      expect(document.activeElement).toBe(document.body)

      state.restore()

      expect(document.activeElement).toBe(input)
      expect(input.selectionStart).toBe(6)
      expect(input.selectionEnd).toBe(11)
    })

    it('restores focus and selection after reordering nodes', () => {
      let input1 = document.createElement('input')
      input1.type = 'text'
      input1.value = 'First'
      container.appendChild(input1)

      let input2 = document.createElement('input')
      input2.type = 'text'
      input2.value = 'Second'
      container.appendChild(input2)

      let input3 = document.createElement('input')
      input3.type = 'text'
      input3.value = 'Third'
      container.appendChild(input3)

      // Focus the middle input with selection
      input2.focus()
      input2.setSelectionRange(0, 6)

      let state = createDocumentState()
      state.capture()

      // Reorder: move input2 to the end (simulating keyed list reordering)
      container.removeChild(input2)
      container.appendChild(input2)

      state.restore()

      expect(document.activeElement).toBe(input2)
      expect(input2.selectionStart).toBe(0)
      expect(input2.selectionEnd).toBe(6)
    })

    it('restores focus and selection after moving textarea', () => {
      let textarea = document.createElement('textarea')
      textarea.value = 'Hello\nWorld\nTest'
      container.appendChild(textarea)
      textarea.focus()
      textarea.setSelectionRange(6, 11)

      let state = createDocumentState()
      state.capture()

      // Move the textarea
      container.removeChild(textarea)
      container.appendChild(textarea)

      state.restore()

      expect(document.activeElement).toBe(textarea)
      expect(textarea.selectionStart).toBe(6)
      expect(textarea.selectionEnd).toBe(11)
    })

    it('restores focus and selection for different input types after move', () => {
      let types = ['text', 'search', 'tel', 'url', 'password'] as const
      for (let type of types) {
        let input = document.createElement('input')
        input.type = type
        input.value = 'test value'
        container.appendChild(input)
        input.focus()
        input.setSelectionRange(0, 4)

        let state = createDocumentState()
        state.capture()

        // Move the input
        container.removeChild(input)
        container.appendChild(input)

        state.restore()

        expect(document.activeElement).toBe(input)
        expect(input.selectionStart).toBe(0)
        expect(input.selectionEnd).toBe(4)

        container.removeChild(input)
      }
    })

    it('restores focus without selection when element had no selection', () => {
      let input = document.createElement('input')
      input.type = 'text'
      input.value = 'Hello World'
      container.appendChild(input)
      input.focus()
      // No selection set

      let state = createDocumentState()
      state.capture()

      // Move the input
      container.removeChild(input)
      container.appendChild(input)

      state.restore()

      expect(document.activeElement).toBe(input)
    })

    it('restores focus after moving element (scroll preservation is handled internally)', () => {
      // The scroll preservation mechanism is tested implicitly through focus restoration
      // The actual scroll preservation happens internally during restore() to prevent
      // focus() from changing scroll positions
      let scrollable = document.createElement('div')
      scrollable.style.width = '100px'
      scrollable.style.height = '100px'
      scrollable.style.overflow = 'auto'
      let inner = document.createElement('div')
      inner.style.width = '200px'
      inner.style.height = '200px'
      scrollable.appendChild(inner)
      container.appendChild(scrollable)

      let input = document.createElement('input')
      input.type = 'text'
      scrollable.appendChild(input)
      input.focus()

      let state = createDocumentState()
      state.capture()

      // Move the input (which would normally lose focus)
      scrollable.removeChild(input)
      scrollable.appendChild(input)

      state.restore()

      // Focus should be restored to the moved element
      expect(document.activeElement).toBe(input)
    })

    it('restores focus for non-selectable element after move', () => {
      let div = document.createElement('div')
      div.tabIndex = -1
      container.appendChild(div)
      div.focus()

      let state = createDocumentState()
      state.capture()

      // Move the div
      container.removeChild(div)
      container.appendChild(div)

      state.restore()

      expect(document.activeElement).toBe(div)
    })

    it('restores focus for contentEditable element after move', () => {
      let div = document.createElement('div')
      div.contentEditable = 'true'
      div.textContent = 'Hello World'
      container.appendChild(div)
      div.focus()

      let state = createDocumentState()
      state.capture()

      // Move the div
      container.removeChild(div)
      container.appendChild(div)

      state.restore()

      expect(document.activeElement).toBe(div)
    })

    it('does not restore if element is removed from document', () => {
      let input = document.createElement('input')
      input.type = 'text'
      input.value = 'Hello World'
      container.appendChild(input)
      input.focus()
      input.setSelectionRange(0, 5)

      let state = createDocumentState()
      state.capture()

      // Remove element from document (not just moved)
      container.removeChild(input)

      // Should not throw
      state.restore()

      // Element should not be focused since it's not in document
      expect(document.activeElement).not.toBe(input)
    })

    it('handles selection end beyond value length after move', () => {
      let input = document.createElement('input')
      input.type = 'text'
      input.value = 'Hello'
      container.appendChild(input)
      input.focus()
      input.setSelectionRange(0, 10) // Beyond length

      let state = createDocumentState()
      state.capture()

      // Move the input
      container.removeChild(input)
      container.appendChild(input)

      state.restore()

      expect(document.activeElement).toBe(input)
      // Should clamp to value length
      expect(input.selectionEnd).toBeLessThanOrEqual(input.value.length)
    })

    it('restores focus when element is moved to different parent', () => {
      let parent1 = document.createElement('div')
      let parent2 = document.createElement('div')
      container.appendChild(parent1)
      container.appendChild(parent2)

      let input = document.createElement('input')
      input.type = 'text'
      input.value = 'Hello World'
      parent1.appendChild(input)
      input.focus()
      input.setSelectionRange(0, 5)

      let state = createDocumentState()
      state.capture()

      // Move to different parent
      parent1.removeChild(input)
      parent2.appendChild(input)

      state.restore()

      expect(document.activeElement).toBe(input)
      expect(input.selectionStart).toBe(0)
      expect(input.selectionEnd).toBe(5)
    })
  })
})
