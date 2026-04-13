// @jsxRuntime classic
// @jsx createElement
import { createElement, createMixin, on, type ElementProps } from '@remix-run/component'

let HIDDEN_TYPEAHEAD_TIMEOUT = 750

export type SearchValue = string | string[]

type HiddenTypeaheadHandler = (text: string) => void

export let hiddenTypeahead = createMixin<
  HTMLElement,
  [onTypeahead: HiddenTypeaheadHandler],
  ElementProps
>((handle) => {
  let text = ''
  let timeoutId = 0

  function clearTypeahead() {
    clearTimeout(timeoutId)
    timeoutId = 0
    text = ''
  }

  function updateTypeahead(nextText: string, onTypeahead: HiddenTypeaheadHandler) {
    text = nextText
    onTypeahead(text)
  }

  handle.addEventListener('remove', clearTypeahead)

  return (onTypeahead, props) => (
    <handle.element
      {...props}
      mix={[
        on('focusout', (event) => {
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          ) {
            return
          }

          clearTypeahead()
        }),
        on('keydown', (event) => {
          if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
            clearTimeout(timeoutId)
            updateTypeahead(text + event.key.toLowerCase(), onTypeahead)
            timeoutId = window.setTimeout(clearTypeahead, HIDDEN_TYPEAHEAD_TIMEOUT)
          } else if (event.key === 'Escape') {
            clearTypeahead()
          } else if (event.key === 'Backspace' && text.length > 0) {
            clearTimeout(timeoutId)
            updateTypeahead(text.slice(0, -1), onTypeahead)
            timeoutId = window.setTimeout(clearTypeahead, HIDDEN_TYPEAHEAD_TIMEOUT)
          }
        }),
      ]}
    />
  )
})

export function itemMatchesSearchText<item>(
  item: item,
  text: string,
  getSearchValues: (item: item) => SearchValue,
) {
  let values = getSearchValues(item)
  let searchValues = Array.isArray(values) ? values : [values]
  let normalizedText = text.toLowerCase()

  return searchValues.some((value) => value.toLowerCase().startsWith(normalizedText))
}

export function matchNextItemBySearchText<item>(
  text: string,
  items: item[],
  options: {
    fromIndex: number
    getSearchValues: (item: item) => SearchValue
  },
) {
  if (text === '') {
    return null
  }

  for (let offset = 1; offset <= items.length; offset++) {
    let item = items[(options.fromIndex + offset + items.length) % items.length]
    if (itemMatchesSearchText(item, text, options.getSearchValues)) {
      return item
    }
  }

  return null
}
