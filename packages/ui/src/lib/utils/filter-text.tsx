// @jsxRuntime classic
// @jsx createElement
import { createElement, createMixin, on, type ElementProps } from '@remix-run/component'

type FilterTextHandler = (text: string) => void

type FilterTextOptions = {
  timeout?: number
}

export const filterText = createMixin<
  HTMLElement,
  [onText: FilterTextHandler, options?: FilterTextOptions],
  ElementProps
>((handle) => {
  let text = ''
  let timeoutId = 0
  type FilterTextMixinArgs =
    | [onText: FilterTextHandler, props: ElementProps]
    | [onText: FilterTextHandler, options: FilterTextOptions | undefined, props: ElementProps]

  function clearFilter() {
    clearTimeout(timeoutId)
    timeoutId = 0
    text = ''
  }

  function updateFilter(nextText: string, onText: FilterTextHandler) {
    text = nextText
    onText(text)
  }

  handle.addEventListener('remove', clearFilter)

  return (...args: FilterTextMixinArgs) => {
    let onText = args[0]
    let options = args.length === 3 ? args[1] : undefined
    let props = args.length === 3 ? args[2] : args[1]
    let timeout = options?.timeout ?? 750

    return (
      <handle.element
        {...props}
        mix={on('keydown', (event) => {
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
            event.stopPropagation()

            clearTimeout(timeoutId)
            updateFilter(text + event.key.toLowerCase(), onText)
            timeoutId = window.setTimeout(clearFilter, timeout)
          } else if (event.key === 'Escape') {
            clearFilter()
          } else if (event.key === 'Backspace' && text.length > 0) {
            updateFilter(text.slice(0, -1), onText)
          }
        })}
      />
    )
  }
})
