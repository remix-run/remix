import { createInteraction } from '../lib/interactions.ts'
import { events } from '../lib/events.ts'
import { dom, doc } from '../lib/proxies.ts'
import { invariant } from '../lib/invariant.ts'

export interface PressOptions {
  hit?: number
  release?: number
  delay?: number
}

export type PressEventDetail =
  | {
      originalEvent: PointerEvent
      target: Element
      inputType: 'pointer'
    }
  | {
      originalEvent: KeyboardEvent
      target: Element
      inputType: 'keyboard'
    }

export interface OuterPressEventDetail {
  originalEvent: PointerEvent
}

function normalizeBox(box: number | undefined, defaultValue: number): number {
  return box ?? defaultValue
}

function isTargetWithinHitBox(
  element: Element,
  event: PointerEvent,
  options: PressOptions = {},
): boolean {
  let rect = element.getBoundingClientRect()
  let hit = normalizeBox(options.hit, 10)

  return (
    event.clientX >= rect.left - hit &&
    event.clientX <= rect.right + hit &&
    event.clientY >= rect.top - hit &&
    event.clientY <= rect.bottom + hit
  )
}

function isTargetWithinReleaseBox(
  element: Element,
  event: PointerEvent,
  options: PressOptions = {},
): boolean {
  let rect = element.getBoundingClientRect()
  let hit = normalizeBox(options.hit, 10)
  let release = normalizeBox(options.release, 10)
  let totalBox = hit + release

  return (
    event.clientX >= rect.left - totalBox &&
    event.clientX <= rect.right + totalBox &&
    event.clientY >= rect.top - totalBox &&
    event.clientY <= rect.bottom + totalBox
  )
}

let dispatchedPressDownEvents = new WeakSet<Event>()

export type PressEvent = CustomEventInit<PressEventDetail>

/**
 * A press down interaction that dispatches a press down event when the pointer is down
 * and the target is within the hit box.
 *
 * - The target will have the `rmx-active` attribute set to `true` when the press is down.
 * - The target will have the `rmx-active` attribute removed when the pointer is up.
 */
export let pressDown = createInteraction<Element, PressEventDetail, PressOptions>(
  'pressDown',
  ({ dispatch, target }, options = {}) => {
    let pointerDownHandler = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (isTargetWithinHitBox(target, e, options)) {
        let bubbles = !dispatchedPressDownEvents.has(e)
        if (bubbles) {
          dispatchedPressDownEvents.add(e)
        }
        // target.setAttribute('rmx-active', 'true')
        dispatch(
          {
            detail: {
              originalEvent: e,
              target: target,
              inputType: 'pointer',
            },
            bubbles,
          },
          e,
        )
      }
    }

    let keyDownHandler = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        // target.setAttribute('rmx-active', 'true')
        dispatch(
          {
            detail: {
              originalEvent: e,
              target: target,
              inputType: 'keyboard',
            },
          },
          e,
        )
      }
    }

    let pointerUpHandler = () => {
      // target.removeAttribute('rmx-active')
    }

    return [
      events(document, [doc.pointerdown(pointerDownHandler)]),
      events(target, [dom.keydown(keyDownHandler), pressUp(pointerUpHandler)]),
    ]
  },
)

let dispatchedPressUpEvents = new WeakSet<Event>()

export let pressUp = createInteraction<Element, PressEventDetail, PressOptions>(
  'pressUp',
  ({ dispatch, target }, options = {}) => {
    let pointerUpHandler = (e: PointerEvent) => {
      if (isTargetWithinReleaseBox(target, e, options)) {
        let bubbles = !dispatchedPressUpEvents.has(e)
        if (bubbles) {
          dispatchedPressUpEvents.add(e)
        }
        dispatch(
          {
            detail: {
              originalEvent: e,
              target: target,
              inputType: 'pointer',
            },
            bubbles,
          },
          e,
        )
      }
    }

    let keyUpHandler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        dispatch(
          {
            detail: {
              originalEvent: e,
              target: target,
              inputType: 'keyboard',
            },
          },
          e,
        )
      }
    }

    return [
      events(document, [doc.pointerup(pointerUpHandler)]),
      events(target, [dom.keyup(keyUpHandler)]),
    ]
  },
)

export let longPress = createInteraction<Element, PressEventDetail, PressOptions>(
  'longPress',
  ({ dispatch, target }, options = {}) => {
    let timer: number
    let startDetail: PressEventDetail | null = null
    let activePointers = new Set<number>()

    let clearTimer = () => {
      window.clearTimeout(timer)
    }

    let startHandler = (event: CustomEvent) => {
      startDetail = event.detail
      clearTimer()
      timer = window.setTimeout(() => {
        invariant(startDetail)
        dispatch({ detail: startDetail })
      }, options.delay ?? 500)

      // Track pointer for move cancellation
      if (startDetail && startDetail.inputType === 'pointer') {
        activePointers.add((startDetail.originalEvent as PointerEvent).pointerId)
      }
    }

    let endHandler = () => {
      clearTimer()
      activePointers.clear()
    }

    let pointerMoveHandler = (e: PointerEvent) => {
      if (activePointers.has(e.pointerId)) {
        if (!isTargetWithinReleaseBox(target, e, options)) {
          clearTimer()
          activePointers.delete(e.pointerId)
        }
      }
    }

    return [
      events(target, [pressDown(startHandler, options), pressUp(endHandler, options)]),
      events(document, [doc.pointermove(pointerMoveHandler)]),
      clearTimer,
    ]
  },
)

let dispatchedPressEvents = new WeakSet<Event>()

export let press = createInteraction<Element, PressEventDetail, PressOptions>(
  'press',
  ({ dispatch, target }, options = {}) => {
    let pressing = false
    let longPressed = false
    let startDetail: PressEventDetail | null = null

    let startHandler = (event: CustomEvent) => {
      pressing = true
      longPressed = false
      startDetail = event.detail
    }

    let longPressHandler = () => {
      longPressed = true
      pressing = false // cancel press if long press triggers
    }

    let endHandler = () => {
      if (pressing && !longPressed) {
        invariant(startDetail)

        let originalEvent = startDetail.originalEvent
        let bubbles = !dispatchedPressEvents.has(originalEvent)
        if (bubbles) {
          dispatchedPressEvents.add(originalEvent)
        }
        dispatch({ detail: startDetail, bubbles }, originalEvent)
      }
      pressing = false
    }

    return events(target, [
      pressDown(startHandler, options),
      longPress(longPressHandler, options),
      pressUp(endHandler, options),
    ])
  },
)

export let outerPressDown = createInteraction<Element, OuterPressEventDetail, PressOptions>(
  'outerPressDown',
  ({ dispatch, target }, options = {}) => {
    return events(document, [
      doc.pointerdown((event) => {
        if (
          target instanceof Node &&
          event.target instanceof Node &&
          !target.contains(event.target) &&
          !isTargetWithinHitBox(target, event, options)
        ) {
          dispatch(
            {
              bubbles: false,
              detail: { originalEvent: event },
            },
            event,
          )
        }
      }),
    ])
  },
)

export let outerPressUp = createInteraction<Element, OuterPressEventDetail, PressOptions>(
  'outerPressUp',
  ({ dispatch, target }, options = {}) => {
    let pressed = false
    let startEvent: PointerEvent | null = null

    return [
      events(target, [
        outerPressDown((event) => {
          pressed = true
          startEvent = event.detail.originalEvent
        }, options),
      ]),
      events(document, [
        doc.pointerup((event) => {
          if (
            pressed &&
            target instanceof Node &&
            event.target instanceof Node &&
            !target.contains(event.target) &&
            !isTargetWithinHitBox(target, event, options)
          ) {
            invariant(startEvent)
            dispatch(
              {
                bubbles: false,
                detail: { originalEvent: startEvent },
              },
              startEvent,
            )
          }
          pressed = false
        }),
      ]),
    ]
  },
)

export let outerPress = createInteraction<Element, OuterPressEventDetail, PressOptions>(
  'outerPress',
  ({ dispatch, target }, options = {}) => {
    let pressing = false
    let startEvent: PointerEvent | null = null

    let startHandler = (event: CustomEvent) => {
      pressing = true
      startEvent = event.detail.originalEvent
    }

    let endHandler = () => {
      if (pressing) {
        invariant(startEvent)
        dispatch(
          {
            bubbles: false,
            detail: { originalEvent: startEvent },
          },
          startEvent,
        )
      }
      pressing = false
    }

    return events(target, [
      outerPressDown(startHandler, options),
      outerPressUp(endHandler, options),
    ])
  },
)
