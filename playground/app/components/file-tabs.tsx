import { css, on, ref, type Handle, type RemixNode } from 'remix/ui'

import { closeTab, openFile } from '../store/operations.ts'
import { actions, connect, type AppUiApi, shallowEqual } from '../store/index.ts'

type Tab = {
  /** Absolute, normalized file path — the tab's stable identity. */
  name: string
  /** Display label. */
  label: string
}

/** Build the tab list from the store's open files + template metadata. */
function selectTabs(api: AppUiApi): { tabs: Tab[]; activeName: string | undefined } {
  let { openFiles, templateFiles, activePath } = api.getState()
  let tabs = openFiles.map((path) => {
    let label = path.split('/').slice(-1)[0] ?? path
    return {
      name: path,
      label: templateFiles?.[path.slice(1)]?.readonly ? `${label} (read-only)` : label,
    }
  })
  return { tabs, activeName: activePath }
}

/**
 * The editor's tab bar. It subscribes to the store for the open-file list and
 * active selection, and dispatches {@link openFile} / {@link closeTab} when the
 * user activates or closes a tab — no props, no bubbled events. The only local
 * state is roving keyboard focus, a pure UI concern.
 */
export function FileTabs(handle: Handle<{ api: AppUiApi }>) {
  let { api } = handle.props
  // Subscribe to the slice that drives this view. `selectTabs` builds a fresh
  // object each call, so compare shallowly to avoid needless re-renders.
  let view = connect(handle, api, () => selectTabs(api), shallowEqual)

  // Roving-tabindex focus is local UI state, not data.
  let focused: string | undefined = view().activeName ?? view().tabs[0]?.name

  // Live map of the focusable inner <button> for each tab.
  let buttons = new Map<string, HTMLElement>()

  // Update focus, re-render, then re-assert DOM focus on the focused tab so the
  // keyboard survives reconciliation.
  function commit(nextFocus: string | undefined) {
    focused = nextFocus
    handle.update()
    if (focused) {
      let name = focused
      handle.queueTask(() => buttons.get(name)?.focus())
    }
  }

  function tabs() {
    return view().tabs
  }

  function indexOf(name: string) {
    return tabs().findIndex((t) => t.name === name)
  }

  function focusAt(index: number) {
    let list = tabs()
    if (list.length === 0) return
    let wrapped = ((index % list.length) + list.length) % list.length
    commit(list[wrapped]!.name)
  }

  function select(name: string) {
    commit(name)
    api.dispatch(actions.setEditorView('editor'))
    api.dispatch(openFile(name))
  }

  function close(name: string) {
    let list = tabs()
    let index = indexOf(name)
    if (focused === name) {
      let neighbor = list[index + 1] ?? list[index - 1]
      commit(neighbor?.name)
    }
    api.dispatch(closeTab(name))
  }

  function onKeyDown(event: KeyboardEvent, name: string) {
    let index = indexOf(name)
    if (index === -1) return

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        focusAt(index + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        focusAt(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusAt(0)
        break
      case 'End':
        event.preventDefault()
        focusAt(tabs().length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        select(name)
        break
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        close(name)
        break
    }
  }

  return () => {
    let { tabs: list, activeName: active } = view()

    // Keep roving focus on a tab that still exists.
    if (!list.some((t) => t.name === focused)) {
      focused = active && list.some((t) => t.name === active) ? active : list[0]?.name
    }

    let rows: RemixNode[] = list.map((tab) => {
      let isActive = tab.name === active
      return (
        <jui-button key={tab.name} size="xs" variant={isActive ? undefined : 'muted'}>
          <button
            role="tab"
            aria-selected={isActive ? 'true' : 'false'}
            tabindex={focused === tab.name ? 0 : -1}
            mix={[
              ref((node: HTMLElement, signal) => {
                buttons.set(tab.name, node)
                signal.addEventListener('abort', () => {
                  if (buttons.get(tab.name) === node) buttons.delete(tab.name)
                })
              }),
              on<HTMLElement>('click', () => select(tab.name)),
              on<HTMLElement>('keydown', (event) => onKeyDown(event as KeyboardEvent, tab.name)),
            ]}
          >
            <jui-group nowrap gap="xs">
              <span truncate>{tab.label}</span>
              <span
                role="button"
                aria-label={`Close ${tab.name}`}
                mix={[
                  css({ cursor: 'pointer' }),
                  on<HTMLElement>('click', (event) => {
                    event.stopPropagation()
                    close(tab.name)
                  }),
                ]}
              >
                ×
              </span>
            </jui-group>
          </button>
        </jui-button>
      )
    })

    return (
      <jui-group
        // @ts-expect-error - role is a valid host attribute
        role="tablist"
        aria-label="Open files"
        nowrap
        scrollx
        gap="xs"
        grow
        p="xs"
      >
        {rows}
      </jui-group>
    )
  }
}
