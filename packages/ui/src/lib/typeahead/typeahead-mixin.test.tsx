import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, type RemixNode } from '@remix-run/component'

import {
  hiddenTypeahead,
  itemMatchesSearchText,
  matchNextItemBySearchText,
} from './typeahead-mixin.ts'

const typeaheadTimeoutMs = 750
let roots: ReturnType<typeof createRoot>[] = []

type SearchItem = {
  label: string
  searchValue: string | string[]
}

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

function renderTypeahead(onTypeahead: (text: string) => void) {
  return renderApp(
    <>
      <div id="scope" tabIndex={-1} mix={hiddenTypeahead(onTypeahead)}>
        <button id="inside-a" type="button">
          Inside A
        </button>
        <button id="inside-b" type="button">
          Inside B
        </button>
      </div>
      <button id="outside" type="button">
        Outside
      </button>
    </>,
  )
}

function getById<elementType extends HTMLElement>(container: HTMLElement, id: string) {
  return container.querySelector(`#${id}`) as elementType
}

function key(target: HTMLElement, keyValue: string, options: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...options,
    key: keyValue,
  })
  target.dispatchEvent(event)
  return event
}

async function settle(root: ReturnType<typeof createRoot>) {
  await Promise.resolve()
  root.flush()
  await Promise.resolve()
  root.flush()
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('itemMatchesSearchText', () => {
  it('matches search text case-insensitively against string and array values', () => {
    let stringItem = { searchValue: 'Remix framework' }
    let arrayItem = { searchValue: ['Beta', 'Workbench'] }

    expect(itemMatchesSearchText(stringItem, 're', (item) => item.searchValue)).toBe(true)
    expect(itemMatchesSearchText(stringItem, 'FRAME', (item) => item.searchValue)).toBe(false)
    expect(itemMatchesSearchText(arrayItem, 'be', (item) => item.searchValue)).toBe(true)
    expect(itemMatchesSearchText(arrayItem, 'work', (item) => item.searchValue)).toBe(true)
    expect(itemMatchesSearchText(arrayItem, 'prod', (item) => item.searchValue)).toBe(false)
  })
})

describe('matchNextItemBySearchText', () => {
  it('starts after fromIndex, wraps around, and returns null for empty or missing matches', () => {
    let items: SearchItem[] = [
      { label: 'Remix', searchValue: 'remix' },
      { label: 'Staging', searchValue: ['beta', 'staging'] },
      { label: 'Local', searchValue: ['dev', 'local'] },
    ]

    expect(
      matchNextItemBySearchText('de', items, {
        fromIndex: 1,
        getSearchValues: (item) => item.searchValue,
      }),
    ).toBe(items[2])

    expect(
      matchNextItemBySearchText('re', items, {
        fromIndex: 2,
        getSearchValues: (item) => item.searchValue,
      }),
    ).toBe(items[0])

    expect(
      matchNextItemBySearchText('', items, {
        fromIndex: 0,
        getSearchValues: (item) => item.searchValue,
      }),
    ).toBeNull()

    expect(
      matchNextItemBySearchText('zz', items, {
        fromIndex: 0,
        getSearchValues: (item) => item.searchValue,
      }),
    ).toBeNull()
  })
})

describe('hiddenTypeahead', () => {
  it('builds a lowercase query from printable key presses and ignores modified and non-printable keys', async () => {
    let calls: string[] = []
    let { container, root } = renderTypeahead((text) => {
      calls.push(text)
    })
    let scope = getById<HTMLDivElement>(container, 'scope')

    key(scope, 'R')
    await settle(root)
    key(scope, 'e')
    await settle(root)
    key(scope, 'ArrowDown')
    await settle(root)
    key(scope, 'x', { ctrlKey: true })
    await settle(root)
    key(scope, 'y', { altKey: true })
    await settle(root)
    key(scope, 'z', { metaKey: true })
    await settle(root)

    expect(calls).toEqual(['r', 're'])
  })

  it('trims the current query with Backspace and lets Escape clear it without emitting', async () => {
    let calls: string[] = []
    let { container, root } = renderTypeahead((text) => {
      calls.push(text)
    })
    let scope = getById<HTMLDivElement>(container, 'scope')

    key(scope, 'R')
    await settle(root)
    key(scope, 'e')
    await settle(root)
    key(scope, 'Backspace')
    await settle(root)
    key(scope, 'Backspace')
    await settle(root)
    key(scope, 'Escape')
    await settle(root)
    key(scope, 'a')
    await settle(root)

    expect(calls).toEqual(['r', 're', 'r', '', 'a'])
  })

  it('clears the query after the timeout so the next key starts a new search', async () => {
    vi.useFakeTimers()

    let calls: string[] = []
    let { container, root } = renderTypeahead((text) => {
      calls.push(text)
    })
    let scope = getById<HTMLDivElement>(container, 'scope')

    key(scope, 'r')
    await settle(root)

    await vi.advanceTimersByTimeAsync(typeaheadTimeoutMs + 1)
    await settle(root)

    key(scope, 'e')
    await settle(root)

    expect(calls).toEqual(['r', 'e'])
  })

  it('keeps the query when focus stays inside the subtree and clears it when focus moves outside', async () => {
    let calls: string[] = []
    let { container, root } = renderTypeahead((text) => {
      calls.push(text)
    })
    let scope = getById<HTMLDivElement>(container, 'scope')
    let insideB = getById<HTMLButtonElement>(container, 'inside-b')
    let outside = getById<HTMLButtonElement>(container, 'outside')

    key(scope, 'r')
    await settle(root)

    scope.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: insideB,
      }),
    )
    await settle(root)

    key(scope, 'e')
    await settle(root)

    expect(calls).toEqual(['r', 're'])

    scope.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: outside,
      }),
    )
    await settle(root)

    key(scope, 'a')
    await settle(root)

    expect(calls).toEqual(['r', 're', 'a'])
  })
})
