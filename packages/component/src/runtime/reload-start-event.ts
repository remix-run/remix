import type { ReloadDetails } from './reload-details.ts'

/**
 * Event dispatched when a direct or ancestor-driven reload of a frame starts.
 */
export type FrameReloadStartEvent = Event &
  ReloadDetails & {
    /**
     * The initiating anchor, area, or owning form. `null` for programmatic reloads, programmatic
     * navigations, and history traversal.
     */
    readonly element: HTMLAnchorElement | HTMLAreaElement | HTMLFormElement | null
  }

/**
 * What a `reloadStart` event describes: the navigation that started the reload, if any, and the
 * reload's outcome.
 */
export type FrameReloadStartEventInit = {
  src: string
  method: string
  encType: string | null
  formData?: FormData
  element?: HTMLAnchorElement | HTMLAreaElement | HTMLFormElement
  submitter?: HTMLElement | null
  finished: ReloadDetails['finished']
}

// The initiating request, inherited by frames that reload while rendering its response.
export type ReloadOrigin = Omit<FrameReloadStartEventInit, 'finished'>

/**
 * Creates a `reloadStart` event.
 *
 * @param init The reload's submission and outcome.
 * @returns A `reloadStart` event carrying the reload's details.
 */
export function createFrameReloadStartEvent(
  init: FrameReloadStartEventInit,
): FrameReloadStartEvent {
  return Object.assign(new Event('reloadStart'), {
    src: init.src,
    method: init.method,
    encType: init.encType,
    formData: init.formData ?? null,
    element: init.element ?? null,
    submitter: init.submitter ?? null,
    finished: init.finished,
  })
}
