import { definePlugin } from '@remix-run/reconciler'
import type { PluginDefinition, ReconcilerRoot, RenderValue } from '@remix-run/reconciler'

export type DocumentState = {
  document: Document
  isCommitting: boolean
  commitCount: number
}

let documentStateByRoot = new WeakMap<ReconcilerRoot<RenderValue>, DocumentState>()

export function createDocumentStatePlugin(document: Document): PluginDefinition<any> {
  return definePlugin((rootHandle) => {
    let state: DocumentState = {
      document,
      isCommitting: false,
      commitCount: 0,
    }
    documentStateByRoot.set(rootHandle.root, state)

    rootHandle.addEventListener('beforeCommit', () => {
      state.isCommitting = true
    })

    rootHandle.addEventListener('afterCommit', () => {
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
