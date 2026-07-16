import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot } from 'remix/ui'

import { CodeBlockCopyButtons } from './code-block-copy.browser.tsx'

describe('CodeBlockCopyButtons', () => {
  it('restarts after navigation and cancels stale clipboard work', async (t) => {
    let attemptedCopies: string[] = []
    let resolveFirstCopy: (() => void) | undefined
    let clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText(text: string) {
          attemptedCopies.push(text)
          if (attemptedCopies.length === 1) {
            return new Promise<void>((resolve) => {
              resolveFirstCopy = resolve
            })
          }
          return Promise.resolve()
        },
      },
    })

    let content = document.createElement('div')
    content.innerHTML = `
      <div id="test-code-blocks">
        <div data-code-block>
          <pre>let count = 1</pre>
          <button type="button" data-code-block-copy>Copy</button>
        </div>
      </div>
    `
    document.body.append(content)

    let behaviorContainer = document.createElement('div')
    let root = createRoot(behaviorContainer)
    let codeBlocks = getElement('test-code-blocks')
    let copyButton = codeBlocks.querySelector<HTMLButtonElement>('[data-code-block-copy]')
    if (!copyButton) throw new Error('Missing code block copy button')

    t.after(() => {
      root.dispose()
      content.remove()
      if (clipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
      } else {
        Reflect.deleteProperty(navigator, 'clipboard')
      }
    })

    root.render(<CodeBlockCopyButtons rootId="test-code-blocks" />)
    root.flush()
    copyButton.click()
    assert.deepEqual(attemptedCopies, ['let count = 1'])

    codeBlocks.id = 'next-code-blocks'
    root.render(<CodeBlockCopyButtons rootId="next-code-blocks" />)
    root.flush()

    if (!resolveFirstCopy) throw new Error('Clipboard write did not start')
    resolveFirstCopy()
    await Promise.resolve()
    assert.equal(copyButton.hasAttribute('data-copied'), false)

    copyButton.click()
    await Promise.resolve()
    assert.deepEqual(attemptedCopies, ['let count = 1', 'let count = 1'])
    assert.equal(copyButton.getAttribute('data-copied'), 'true')

    root.render(<CodeBlockCopyButtons rootId="next-code-blocks" />)
    root.flush()
    assert.equal(copyButton.hasAttribute('data-copied'), false)
  })
})

function getElement(id: string): HTMLElement {
  let element = document.getElementById(id)
  if (!element) throw new Error(`Missing test element #${id}`)
  return element
}
