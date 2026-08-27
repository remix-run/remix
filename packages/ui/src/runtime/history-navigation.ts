import { reloadFrameForNavigation } from './frame.ts'
import { setNavigationDriver } from './navigation-driver.ts'
import {
  reloadNavigationFrame,
  type FormSubmission,
  type NavigationFrameOptions,
} from './navigation-frame.ts'
import type { NavigationState } from './navigation.ts'
import { getNamedFrame, getTopFrame } from './run.ts'

interface HistoryNavigationEntry {
  id: string
  index: number
  navigation: NavigationState
  scroll: { x: number; y: number }
  version: 1
}

type HistoryAction = 'push' | 'replace' | 'traverse'

const historyStateKey = '__remixNavigation'
let nextEntryId = 0
let supportsFormDataSubmitter: boolean | undefined

export function startHistoryNavigationListener(signal: AbortSignal): void {
  startHistoryNavigationListenerImpl(signal, {
    getTopFrame,
    getNamedFrame,
    reloadFrame: reloadFrameForNavigation,
  })
}

export function startHistoryNavigationListenerImpl(
  signal: AbortSignal,
  options: NavigationFrameOptions,
): void {
  let previousScrollRestoration = window.history.scrollRestoration
  let currentEntry = getHistoryNavigationEntry(window.history.state) ?? {
    id: createEntryId(),
    index: 0,
    navigation: createNavigationState(window.location.href),
    scroll: getScrollPosition(),
    version: 1,
  }
  let activeController: AbortController | undefined
  let activeTransition = 0
  let imageSubmitCoordinates = new WeakMap<HTMLInputElement, { x: number; y: number }>()
  let scrollPositions = new Map([[currentEntry.id, currentEntry.scroll]])
  let scrollSaveTimer: ReturnType<typeof setTimeout> | undefined

  replaceHistoryEntry(currentEntry, window.location.href)
  window.history.scrollRestoration = 'manual'

  setNavigationDriver(signal, {
    navigate(href, state, history) {
      let destination = new URL(href, document.baseURI)
      if (!canRewriteHistory(destination)) {
        if (history === 'replace') window.location.replace(destination.href)
        else window.location.assign(destination.href)
        return Promise.resolve()
      }

      return startTransition(destination, state, history ?? getDefaultHistoryAction(destination))
    },
  })

  window.addEventListener(
    'click',
    (event) => {
      if (!(event instanceof MouseEvent)) return

      let source = getEventSource(event)
      if (source instanceof HTMLInputElement && source.type.toLowerCase() === 'image') {
        imageSubmitCoordinates.set(source, {
          x: Math.max(0, Math.floor(event.offsetX)),
          y: Math.max(0, Math.floor(event.offsetY)),
        })
        void Promise.resolve().then(() => imageSubmitCoordinates.delete(source))
      }

      let link = source instanceof Element ? source.closest('a, area') : null
      if (!link) return
      let destination = getLinkDestination(link)
      if (!destination || !shouldHandleLink(event, link, destination)) return
      let state = createNavigationState(destination.href, link)
      let history = getHistoryAction(link.getAttribute('data-rmx-history'), 'push')

      event.preventDefault()
      void startTransition(destination, state, history).catch(() => {})
    },
    { signal },
  )

  window.addEventListener(
    'submit',
    (event) => {
      if (!(event instanceof SubmitEvent)) return
      if (event.defaultPrevented) return
      let form = event.target
      if (!(form instanceof HTMLFormElement)) return

      let submitter = getSubmitter(event)
      if (!shouldHandleForm(form, submitter)) return

      let method = getFormMethod(form, submitter)
      let destination = new URL(getFormAction(form, submitter), document.baseURI)
      if (!canRewriteHistory(destination)) return

      let imageCoordinates =
        submitter instanceof HTMLInputElement ? imageSubmitCoordinates.get(submitter) : undefined
      if (submitter instanceof HTMLInputElement) imageSubmitCoordinates.delete(submitter)
      let formData = createFormData(form, submitter, imageCoordinates)
      let submission: FormSubmission | undefined
      if (method === 'get') {
        destination = getFormDestination(destination, formData)
      } else {
        submission = {
          formData,
          method,
          encType: getFormEncType(form, submitter),
        }
      }

      let state = createFormNavigationState(destination.href, form, submitter)
      let defaultHistory: 'push' | 'replace' =
        submission && destination.href === window.location.href ? 'replace' : 'push'
      let history = getHistoryAction(
        getNavigationAttribute(form, submitter, 'data-rmx-history'),
        defaultHistory,
      )

      event.preventDefault()
      void startTransition(destination, state, history, submission).catch(() => {})
    },
    { signal },
  )

  window.addEventListener(
    'popstate',
    (event) => {
      let entry = getHistoryNavigationEntry(event.state)
      if (!entry) {
        window.location.reload()
        return
      }

      cancelScheduledScrollSave()
      entry = { ...entry, scroll: scrollPositions.get(entry.id) ?? entry.scroll }
      currentEntry = entry
      void startTransition(
        new URL(window.location.href),
        entry.navigation,
        'traverse',
        undefined,
        entry,
      ).catch(() => {})
    },
    { signal },
  )

  window.addEventListener(
    'scroll',
    () => {
      if (activeController) return
      currentEntry = { ...currentEntry, scroll: getScrollPosition() }
      scrollPositions.set(currentEntry.id, currentEntry.scroll)
      scheduleScrollSave()
    },
    { passive: true, signal },
  )

  window.addEventListener('pagehide', persistCurrentScroll, { signal })

  signal.addEventListener(
    'abort',
    () => {
      activeController?.abort()
      cancelScheduledScrollSave()
      persistCurrentScroll()
      window.history.scrollRestoration = previousScrollRestoration
    },
    { once: true },
  )

  async function startTransition(
    destination: URL,
    state: NavigationState,
    action: HistoryAction,
    submission?: FormSubmission,
    traversedEntry?: HistoryNavigationEntry,
  ): Promise<void> {
    activeController?.abort()
    let controller = new AbortController()
    activeController = controller
    let transition = ++activeTransition
    let userScrolled = false
    let pointerDown = false
    let focusChanged = false
    let startingFocus = document.activeElement
    let savedScroll = traversedEntry?.scroll ?? getScrollPosition()
    let onPointerDown = () => {
      pointerDown = true
    }
    let onPointerUp = () => {
      pointerDown = false
    }
    let onScroll = () => {
      if (pointerDown) userScrolled = true
    }
    let onUserScroll = () => {
      userScrolled = true
    }
    let onKeyDown = (event: KeyboardEvent) => {
      if (isScrollKey(event)) userScrolled = true
    }
    let onFocusIn = () => {
      focusChanged = true
    }
    window.addEventListener('pointerdown', onPointerDown, { signal: controller.signal })
    window.addEventListener('pointerup', onPointerUp, { signal: controller.signal })
    window.addEventListener('pointercancel', onPointerUp, { signal: controller.signal })
    window.addEventListener('mousedown', onPointerDown, { signal: controller.signal })
    window.addEventListener('mouseup', onPointerUp, { signal: controller.signal })
    window.addEventListener('wheel', onUserScroll, { passive: true, signal: controller.signal })
    window.addEventListener('touchmove', onUserScroll, { passive: true, signal: controller.signal })
    window.addEventListener('keydown', onKeyDown, { signal: controller.signal })
    window.addEventListener('focusin', onFocusIn, { signal: controller.signal })
    window.addEventListener('scroll', onScroll, { passive: true, signal: controller.signal })

    if (action === 'traverse') {
      if (!traversedEntry) throw new Error('Expected a traversed history entry')
      currentEntry = traversedEntry
    } else {
      adoptActiveHistoryEntry()
      currentEntry = { ...currentEntry, scroll: getScrollPosition() }
      scrollPositions.set(currentEntry.id, currentEntry.scroll)
      cancelScheduledScrollSave()

      if (action === 'replace') {
        currentEntry = {
          ...currentEntry,
          navigation: state,
          scroll: getScrollPosition(),
        }
        replaceHistoryEntry(currentEntry, destination.href)
      } else {
        replaceHistoryEntry(currentEntry)
        currentEntry = {
          id: createEntryId(),
          index: currentEntry.index + 1,
          navigation: state,
          scroll: { x: 0, y: 0 },
          version: 1,
        }
        scrollPositions.set(currentEntry.id, currentEntry.scroll)
        window.history.pushState(
          createHistoryState(window.history.state, currentEntry),
          '',
          destination.href,
        )
      }
    }

    try {
      let { frame, topFrame, redirectedTo } = await reloadNavigationFrame(
        destination.href,
        state,
        controller.signal,
        submission,
        options,
      )
      throwIfStale(controller, transition)

      if (redirectedTo && frame === topFrame) {
        let redirectDestination = new URL(redirectedTo, destination)
        if (!canRewriteHistory(redirectDestination)) {
          window.location.replace(redirectDestination.href)
          return
        }
        state = { ...state, src: redirectDestination.href }
        currentEntry = { ...currentEntry, navigation: state }
        topFrame.src = redirectDestination.href
        replaceHistoryEntry(currentEntry, redirectDestination.href)
        destination = redirectDestination
      }

      if (!focusChanged) resetFocus(startingFocus)
      throwIfStale(controller, transition)
      if (!userScrolled) restoreScroll(destination, state, action, savedScroll)
      throwIfStale(controller, transition)
      let finalScroll = getScrollPosition()
      currentEntry = { ...currentEntry, scroll: finalScroll }
      scrollPositions.set(currentEntry.id, currentEntry.scroll)
      replaceHistoryEntry(currentEntry)
    } finally {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('mouseup', onPointerUp)
      window.removeEventListener('wheel', onUserScroll)
      window.removeEventListener('touchmove', onUserScroll)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('scroll', onScroll)
      if (activeController === controller) activeController = undefined
    }
  }

  function throwIfStale(controller: AbortController, transition: number): void {
    if (!controller.signal.aborted && transition === activeTransition) return
    throw controller.signal.reason ?? new DOMException('Navigation was aborted', 'AbortError')
  }

  function scheduleScrollSave(): void {
    if (scrollSaveTimer !== undefined) clearTimeout(scrollSaveTimer)
    let entryId = currentEntry.id
    scrollSaveTimer = setTimeout(() => {
      scrollSaveTimer = undefined
      if (currentEntry.id !== entryId) return
      persistCurrentScroll()
    }, 100)
  }

  function cancelScheduledScrollSave(): void {
    if (scrollSaveTimer === undefined) return
    clearTimeout(scrollSaveTimer)
    scrollSaveTimer = undefined
  }

  function persistCurrentScroll(): void {
    let activeEntry = getHistoryNavigationEntry(window.history.state)
    if (activeEntry?.id !== currentEntry.id) return
    currentEntry = { ...currentEntry, scroll: getScrollPosition() }
    scrollPositions.set(currentEntry.id, currentEntry.scroll)
    replaceHistoryEntry(currentEntry)
  }

  function adoptActiveHistoryEntry(): void {
    let activeEntry = getHistoryNavigationEntry(window.history.state)
    if (activeEntry) {
      currentEntry = {
        ...activeEntry,
        scroll: scrollPositions.get(activeEntry.id) ?? activeEntry.scroll,
      }
      return
    }

    currentEntry = {
      id: createEntryId(),
      index: currentEntry.index,
      navigation: createNavigationState(window.location.href),
      scroll: getScrollPosition(),
      version: 1,
    }
    scrollPositions.set(currentEntry.id, currentEntry.scroll)
    replaceHistoryEntry(currentEntry)
  }
}

function createNavigationState(href: string, source?: Element): NavigationState {
  return {
    target: source?.getAttribute('data-rmx-target') ?? undefined,
    src: source?.getAttribute('data-rmx-src') ?? href,
    resetScroll: source?.getAttribute('data-rmx-reset-scroll') !== 'false',
    $rmx: true,
  }
}

function createFormNavigationState(
  href: string,
  form: HTMLFormElement,
  submitter: HTMLButtonElement | HTMLInputElement | null,
): NavigationState {
  return {
    target: getNavigationAttribute(form, submitter, 'data-rmx-target') ?? undefined,
    src: getNavigationAttribute(form, submitter, 'data-rmx-src') ?? href,
    resetScroll: getNavigationAttribute(form, submitter, 'data-rmx-reset-scroll') !== 'false',
    $rmx: true,
  }
}

function shouldHandleLink(event: MouseEvent, link: Element, destination: URL): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (!link.hasAttribute('href')) return false
  if (link.hasAttribute('data-rmx-document') || link.hasAttribute('download')) return false
  let target = link.getAttribute('target') || getBaseTarget()
  if (target && target.toLowerCase() !== '_self') return false
  return canRewriteHistory(destination)
}

function getLinkDestination(link: Element): URL | undefined {
  let href = link.getAttribute('href')
  if (href === null) return
  try {
    return new URL(href, document.baseURI)
  } catch {
    return
  }
}

function shouldHandleForm(
  form: HTMLFormElement,
  submitter: HTMLButtonElement | HTMLInputElement | null,
): boolean {
  if (hasNavigationAttribute(form, submitter, 'data-rmx-document')) return false
  if (getFormMethod(form, submitter) === 'dialog') return false
  let target = getFormTarget(form, submitter)
  return target === '' || target.toLowerCase() === '_self'
}

function getSubmitter(event: SubmitEvent): HTMLButtonElement | HTMLInputElement | null {
  let submitter = event.submitter
  if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement)
    return submitter
  return null
}

function getFormAction(
  form: HTMLFormElement,
  submitter: HTMLButtonElement | HTMLInputElement | null,
): string {
  if (submitter?.hasAttribute('formaction')) return submitter.formAction
  return form.action
}

function getFormMethod(
  form: HTMLFormElement,
  submitter: HTMLButtonElement | HTMLInputElement | null,
): string {
  return (submitter?.hasAttribute('formmethod') ? submitter.formMethod : form.method).toLowerCase()
}

function getFormEncType(
  form: HTMLFormElement,
  submitter: HTMLButtonElement | HTMLInputElement | null,
): string {
  return submitter?.hasAttribute('formenctype') ? submitter.formEnctype : form.enctype
}

function getFormTarget(
  form: HTMLFormElement,
  submitter: HTMLButtonElement | HTMLInputElement | null,
): string {
  let target = submitter?.hasAttribute('formtarget')
    ? submitter.getAttribute('formtarget')
    : form.getAttribute('target')
  return target || getBaseTarget()
}

function getBaseTarget(): string {
  return document.querySelector('base[target]')?.getAttribute('target') ?? ''
}

function getNavigationAttribute(
  form: HTMLFormElement,
  submitter: HTMLButtonElement | HTMLInputElement | null,
  name: string,
): string | null {
  if (submitter?.hasAttribute(name)) return submitter.getAttribute(name)
  return form.getAttribute(name)
}

function hasNavigationAttribute(
  form: HTMLFormElement,
  submitter: HTMLButtonElement | HTMLInputElement | null,
  name: string,
): boolean {
  return submitter?.hasAttribute(name) === true || form.hasAttribute(name)
}

function createFormData(
  form: HTMLFormElement,
  submitter: HTMLButtonElement | HTMLInputElement | null,
  imageCoordinates?: { x: number; y: number },
): FormData {
  if (!submitter) return new FormData(form)
  supportsFormDataSubmitter ??= detectFormDataSubmitterSupport()
  let formData = supportsFormDataSubmitter ? new FormData(form, submitter) : new FormData(form)
  if (submitter instanceof HTMLInputElement && submitter.type.toLowerCase() === 'image') {
    let prefix = submitter.name ? `${submitter.name}.` : ''
    formData.set(`${prefix}x`, String(imageCoordinates?.x ?? 0))
    formData.set(`${prefix}y`, String(imageCoordinates?.y ?? 0))
  } else if (!supportsFormDataSubmitter && submitter.name && !submitter.disabled) {
    formData.append(submitter.name, submitter.value)
  }
  return formData
}

function detectFormDataSubmitterSupport(): boolean {
  let form = document.createElement('form')
  let button = document.createElement('button')
  button.name = '__remix_submitter_test__'
  button.value = 'yes'
  form.append(button)
  try {
    return new FormData(form, button).get(button.name) === button.value
  } catch {
    return false
  }
}

function getFormDestination(action: URL, formData: FormData): URL {
  let destination = new URL(action)
  let search = new URLSearchParams()
  for (let [name, value] of formData) {
    search.append(
      normalizeLineBreaks(name),
      normalizeLineBreaks(typeof value === 'string' ? value : value.name),
    )
  }
  destination.search = search.toString()
  return destination
}

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\r\n')
}

function getHistoryAction(
  value: string | null,
  defaultAction: 'push' | 'replace',
): 'push' | 'replace' {
  if (value === 'replace') return 'replace'
  if (value === 'push') return 'push'
  return defaultAction
}

function getDefaultHistoryAction(destination: URL): 'push' | 'replace' {
  return destination.href === window.location.href ? 'replace' : 'push'
}

function canRewriteHistory(destination: URL): boolean {
  let current = new URL(window.location.href)
  return (
    destination.protocol === current.protocol &&
    destination.username === current.username &&
    destination.password === current.password &&
    destination.host === current.host
  )
}

function getEventSource(event: Event): EventTarget | null {
  let path = typeof event.composedPath === 'function' ? event.composedPath() : []
  return path[0] ?? event.target
}

function isScrollKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return false
  let target = event.target
  if (
    target instanceof HTMLButtonElement ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return false
  }
  if (
    event.key === 'PageUp' ||
    event.key === 'PageDown' ||
    event.key === 'Home' ||
    event.key === 'End'
  ) {
    return true
  }
  return (
    event.key === 'ArrowUp' ||
    event.key === 'ArrowDown' ||
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight' ||
    event.key === ' '
  )
}

function createEntryId(): string {
  nextEntryId++
  return `${Date.now().toString(36)}-${nextEntryId.toString(36)}`
}

function getHistoryNavigationEntry(value: unknown): HistoryNavigationEntry | undefined {
  if (!isRecord(value)) return
  let entry = value[historyStateKey]
  if (!isRecord(entry)) return
  let navigation = entry.navigation
  let scroll = entry.scroll
  if (
    entry.version !== 1 ||
    typeof entry.id !== 'string' ||
    typeof entry.index !== 'number' ||
    !isNavigationState(navigation) ||
    !isRecord(scroll) ||
    typeof scroll.x !== 'number' ||
    typeof scroll.y !== 'number'
  ) {
    return
  }

  return {
    id: entry.id,
    index: entry.index,
    navigation,
    scroll: { x: scroll.x, y: scroll.y },
    version: 1,
  }
}

function isNavigationState(value: unknown): value is NavigationState {
  return (
    isRecord(value) &&
    value.$rmx === true &&
    (typeof value.target === 'string' || value.target === undefined) &&
    typeof value.src === 'string' &&
    typeof value.resetScroll === 'boolean'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createHistoryState(
  value: unknown,
  entry: HistoryNavigationEntry,
): Record<string, unknown> {
  return { ...(isRecord(value) ? value : {}), [historyStateKey]: entry }
}

function replaceHistoryEntry(entry: HistoryNavigationEntry, href?: string): void {
  if (href === undefined) {
    let activeEntry = getHistoryNavigationEntry(window.history.state)
    if (activeEntry && historyEntriesEqual(activeEntry, entry)) return
  }
  window.history.replaceState(createHistoryState(window.history.state, entry), '', href)
}

function historyEntriesEqual(left: HistoryNavigationEntry, right: HistoryNavigationEntry): boolean {
  return (
    left.id === right.id &&
    left.index === right.index &&
    left.navigation.target === right.navigation.target &&
    left.navigation.src === right.navigation.src &&
    left.navigation.resetScroll === right.navigation.resetScroll &&
    left.scroll.x === right.scroll.x &&
    left.scroll.y === right.scroll.y
  )
}

function getScrollPosition(): { x: number; y: number } {
  return { x: window.scrollX, y: window.scrollY }
}

function restoreScroll(
  destination: URL,
  state: NavigationState,
  action: HistoryAction,
  savedPosition: { x: number; y: number },
): void {
  if (!state.resetScroll) {
    let currentPosition = getScrollPosition()
    if (
      action !== 'traverse' &&
      (currentPosition.x !== savedPosition.x || currentPosition.y !== savedPosition.y)
    ) {
      window.scrollTo(savedPosition.x, savedPosition.y)
    }
    return
  }
  if (action === 'traverse') {
    window.scrollTo(savedPosition.x, savedPosition.y)
    return
  }

  let fragmentTarget = getFragmentTarget(destination.hash)
  if (fragmentTarget) fragmentTarget.scrollIntoView()
  else window.scrollTo(0, 0)
}

function getFragmentTarget(hash: string): Element | undefined {
  if (!hash || hash === '#') return
  let name = hash.slice(1)
  try {
    name = decodeURIComponent(name)
  } catch {}
  return document.getElementById(name) ?? document.getElementsByName(name)[0]
}

function resetFocus(startingFocus: Element | null): void {
  let activeElement = document.activeElement
  if (
    activeElement &&
    activeElement !== document.body &&
    activeElement !== startingFocus &&
    activeElement.isConnected
  ) {
    return
  }

  let autofocus = document.querySelector<HTMLElement>('[autofocus]')
  if (autofocus) {
    autofocus.focus({ preventScroll: true })
    if (document.activeElement === autofocus) return
  }

  let body = document.body
  let hadTabIndex = body.hasAttribute('tabindex')
  let tabIndex = body.getAttribute('tabindex')
  if (!hadTabIndex) body.tabIndex = -1
  body.focus({ preventScroll: true })
  if (!hadTabIndex) body.removeAttribute('tabindex')
  else if (tabIndex !== null) body.setAttribute('tabindex', tabIndex)
}
