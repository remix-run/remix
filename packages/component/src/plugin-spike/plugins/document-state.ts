import { definePlugin } from '../types.ts'

type SelectionSnapshot = {
  start: number
  end: number
  direction: 'forward' | 'backward' | 'none'
}

type DocumentStateSnapshot = {
  activeElement: null | HTMLElement
  fallbackId: string
  selection: null | SelectionSnapshot
  scrollLeft: number
  scrollTop: number
}

export const documentState = definePlugin((plugin) => {
  let snapshot: null | DocumentStateSnapshot = null

  plugin.addEventListener('beforeFlush', () => {
    snapshot = captureDocumentState(document)
  })

  plugin.addEventListener('afterFlush', () => {
    if (!snapshot) return
    restoreDocumentState(document, snapshot)
    snapshot = null
  })
})

function captureDocumentState(doc: Document): null | DocumentStateSnapshot {
  let activeElement = doc.activeElement
  if (!activeElement || !(activeElement instanceof HTMLElement)) return null

  return {
    activeElement,
    fallbackId: activeElement.id,
    selection: captureSelection(activeElement),
    scrollLeft: activeElement.scrollLeft,
    scrollTop: activeElement.scrollTop,
  }
}

function restoreDocumentState(doc: Document, snapshot: DocumentStateSnapshot) {
  let nextActiveElement = resolveElement(doc, snapshot)
  if (!nextActiveElement) return

  if (doc.activeElement !== nextActiveElement) {
    nextActiveElement.focus({ preventScroll: true })
  }

  nextActiveElement.scrollLeft = snapshot.scrollLeft
  nextActiveElement.scrollTop = snapshot.scrollTop

  if (snapshot.selection) {
    applySelection(nextActiveElement, snapshot.selection)
  }
}

function resolveElement(doc: Document, snapshot: DocumentStateSnapshot): null | HTMLElement {
  if (snapshot.activeElement?.isConnected) return snapshot.activeElement
  if (!snapshot.fallbackId) return null
  let byId = doc.getElementById(snapshot.fallbackId)
  if (!byId || !(byId instanceof HTMLElement)) return null
  return byId
}

function captureSelection(element: HTMLElement): null | SelectionSnapshot {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.selectionStart == null || element.selectionEnd == null) return null
    return {
      start: element.selectionStart,
      end: element.selectionEnd,
      direction: element.selectionDirection ?? 'none',
    }
  }
  return null
}

function applySelection(element: HTMLElement, selection: SelectionSnapshot) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.setSelectionRange(selection.start, selection.end, selection.direction)
  }
}
