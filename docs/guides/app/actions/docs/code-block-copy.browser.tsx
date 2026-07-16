import { addEventListeners, clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

export const CodeBlockCopyButtons = clientEntry(
  import.meta.url,
  function CodeBlockCopyButtons(handle: Handle<{ rootId: string }>) {
    return () => {
      let rootId = handle.props.rootId
      handle.queueTask((signal) => {
        let root = document.getElementById(rootId)
        if (root) {
          startCodeBlockCopyBehavior(root, signal)
        }
      })

      return null
    }
  },
)

function startCodeBlockCopyBehavior(root: HTMLElement, signal: AbortSignal) {
  let copiedTimers = new Map<HTMLButtonElement, number>()

  addEventListeners(root, signal, {
    async click(event, eventSignal) {
      if (!(event.target instanceof Element)) return

      let button = event.target.closest<HTMLButtonElement>('[data-code-block-copy]')
      if (!button || !root.contains(button)) return

      let codeBlock = button.closest<HTMLElement>('[data-code-block]')
      let text = codeBlock?.querySelector('pre')?.textContent
      if (!text) return

      event.preventDefault()

      try {
        await navigator.clipboard.writeText(text)
      } catch {
        return
      }
      if (eventSignal.aborted) return

      button.dataset.copied = 'true'

      let copiedTimer = copiedTimers.get(button)
      if (copiedTimer !== undefined) {
        window.clearTimeout(copiedTimer)
      }

      copiedTimers.set(
        button,
        window.setTimeout(() => {
          delete button.dataset.copied
          copiedTimers.delete(button)
        }, 1500),
      )
    },
  })

  signal.addEventListener('abort', () => {
    for (let [button, timer] of copiedTimers) {
      window.clearTimeout(timer)
      delete button.dataset.copied
    }
    copiedTimers.clear()
  })
}
