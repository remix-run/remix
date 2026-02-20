import { definePlugin } from '@remix-run/reconciler'
import type { PluginDefinition, ReconcilerRoot, RenderValue } from '@remix-run/reconciler'

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

export type DocumentState = {
  document: Document
  isCommitting: boolean
  commitCount: number
  snapshot: null | DocumentStateSnapshot
}

let documentStateByRoot = new WeakMap<ReconcilerRoot<RenderValue>, DocumentState>()

export function createDocumentStatePlugin(document: Document): PluginDefinition<any> {
  return definePlugin((rootHandle) => {
    let state: DocumentState = {
      document,
      isCommitting: false,
      commitCount: 0,
      snapshot: null,
    }
    documentStateByRoot.set(rootHandle.root, state)

    rootHandle.addEventListener('beforeCommit', () => {
      state.isCommitting = true
      state.snapshot = captureDocumentState(document)
    })

    rootHandle.addEventListener('afterCommit', () => {
      if (state.snapshot) {
        restoreDocumentState(document, state.snapshot)
        state.snapshot = null
      }
      state.isCommitting = false
      state.commitCount++
    })

    return {
      phase: 'special',
      priority: -1000,
      keys: ['__rmx_document_state_internal__'],
      shouldActivate() {
        return false
      },
    }
  })
}

export function getDocumentState(root: ReconcilerRoot<RenderValue>) {
  return documentStateByRoot.get(root)
}

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
  let next = doc.getElementById(snapshot.fallbackId)
  if (!next || !(next instanceof HTMLElement)) return null
  return next
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
