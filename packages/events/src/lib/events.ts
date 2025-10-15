// Core event system types
import type { InteractionDescriptor } from './interactions.ts'

let _debug: boolean = false
export function debug() {
  _debug = true
}
function log(...args: any[]) {
  if (_debug) {
    console.log('DEBUG', ...args)
  }
}

/**
 * Adds events to a target and returns a function to clean them up.
 *
 * @example
 * ```ts
 * import { events, dom } from "@remix-run/events";
 *
 * let cleanup = events(target, [
 *   dom.click(event => {
 *     console.log(event.target);
 *   })
 * ])
 * ```
 */
export function events<Target extends EventTarget>(
  target: Target,
  descriptors: EventDescriptor<Target>[],
): Cleanup

/**
 * Creates a new event container for the given target. Events can be changed
 * dynamically and cleaned up later.
 *
 * @example
 * ```ts
 * import { events, dom } from "@remix-run/events";
 *
 * let container= events(target)
 *
 * container.on([
 *   dom.click(event => {
 *     console.log("first handler");
 *   })
 * ]);
 *
 * container.cleanup();
 * ```
 */
export function events<Target extends EventTarget>(target: Target): EventContainer

export function events<Target extends EventTarget>(
  target: Target,
  initialDescriptors?: EventDescriptor<Target>[],
): EventContainer | Cleanup {
  let descriptors: EventDescriptor<Target>[] = []
  let cleanups: Cleanup[] = []

  let on = (nextDescriptors: EventDescriptor<Target> | EventDescriptor<Target>[] | undefined) => {
    if (!nextDescriptors) {
      nextDescriptors = []
    }

    if (!Array.isArray(nextDescriptors)) {
      nextDescriptors = [nextDescriptors]
    }
    if (descriptorsChanged(descriptors, nextDescriptors)) {
      cleanupAll(cleanups)
      cleanups = []

      if (nextDescriptors.length > 0) {
        attachAllEvents(target, nextDescriptors, cleanups)
      }

      descriptors = nextDescriptors
    } else {
      updateHandlersInPlace(descriptors, nextDescriptors)
    }
  }

  let cleanup = () => {
    cleanupAll(cleanups)
    descriptors = []
    cleanups = []
  }

  if (initialDescriptors) {
    on(initialDescriptors)
    return cleanup
  }

  return { on, cleanup }
}

/**
 * Attach a raw string event to a target. Particularly useful for custom
 * elements and web components.
 *
 * @example
 * ```ts
 * import { events, bind } from "@remix-run/events";
 *
 * events(target, [
 *   bind("custom", event => {
 *     console.log(event.target);
 *   })
 * ])
 * ```
 */
export function bind<E extends Event = Event, ECurrentTarget = any, ETarget = any>(
  type: string,
  handler: EventHandler<E, ECurrentTarget, ETarget>,
  options?: AddEventListenerOptions,
): EventDescriptor<ECurrentTarget> {
  return { type, handler, options }
}

export type EventHandler<E = Event, ECurrentTarget = any, ETarget = any> = (
  event: EventWithTargets<E, ECurrentTarget, ETarget>,
  signal: AbortSignal,
) => any | Promise<any>

export interface EventDescriptor<ECurrentTarget = any> {
  type: string
  handler: EventHandler<any, ECurrentTarget>
  isCustom?: boolean
  options?: AddEventListenerOptions
}

export type EventWithTargets<E = Event, ECurrentTarget = any, ETarget = any> = Omit<
  E,
  'target' | 'currentTarget'
> & {
  target: ETarget
  currentTarget: ECurrentTarget
}

export interface EventContainer {
  on: (events: EventDescriptor | EventDescriptor[] | undefined) => void
  cleanup: () => void
}

export type Cleanup = () => void

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (!a || !b) return false

  if (typeof a !== 'object' || typeof b !== 'object') return false

  let keysA = Object.keys(a)
  let keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  for (let key of keysA) {
    if (a[key] !== b[key]) return false
  }

  return true
}

function createDispatcher<T extends EventTarget>(target: T, type: string) {
  return (options?: CustomEventInit, originalEvent?: Event) => {
    let customEvent = new CustomEvent(type, {
      bubbles: true,
      cancelable: true,
      ...options,
    })

    // Patch stopPropagation to also stop the original event
    if (originalEvent) {
      let originalStopPropagation = customEvent.stopPropagation.bind(customEvent)
      customEvent.stopPropagation = () => {
        originalStopPropagation()
        originalEvent.stopPropagation()
      }
    }

    target.dispatchEvent(customEvent)
  }
}

function prepareInteractions<T extends EventTarget>(
  target: T,
  descriptors: InteractionDescriptor<T>[],
  cleanups: Cleanup[],
) {
  // Only prepare once per unique event type (which now includes options in the name)
  let seenEventTypes = new Set<string>()

  for (let descriptor of descriptors) {
    if (seenEventTypes.has(descriptor.type)) {
      continue // Skip if we've already prepared this event type
    }
    seenEventTypes.add(descriptor.type)

    let dispatch = createDispatcher(target, descriptor.type)

    let factoryResult = descriptor.factory({ dispatch, target }, descriptor.factoryOptions)

    if (factoryResult) {
      let factoryCleanups = Array.isArray(factoryResult) ? factoryResult : [factoryResult]
      cleanups.push(...factoryCleanups)
    }
  }
}

function attach<Target extends EventTarget>(
  target: Target,
  eventType: string,
  descriptors: EventDescriptor<Target>[],
  cleanups: Cleanup[],
) {
  log('attach', { target, eventType, descriptors })

  let preventedEvents = new Set<Event>()

  for (let descriptor of descriptors) {
    let controller = new AbortController()
    let wrappedHandler = (event: Event) => {
      controller.abort(new DOMException('Handler reentered', 'EventReentry'))
      controller = new AbortController()

      log('wrappedHandler', { target, eventType, event })

      if (preventedEvents.has(event)) {
        log('prevented', { target, eventType, event })
        return
      }

      let call = descriptor.handler(event as any, controller.signal)
      if (call instanceof Promise) {
        call.catch((e) => {
          if (e instanceof DOMException && e.name === 'EventReentry') {
            // swallow
          } else {
            throw e
          }
        })
      }

      if (event.defaultPrevented) {
        preventedEvents.add(event)
        setTimeout(() => preventedEvents.delete(event), 0)
      }
    }

    target.addEventListener(eventType, wrappedHandler, descriptor.options)
    cleanups.push(() => {
      controller.abort()
      target.removeEventListener(eventType, wrappedHandler, descriptor.options)
    })
  }
}

function attachStandardEvents<Target extends EventTarget>(
  target: Target,
  descriptors: EventDescriptor<Target>[],
  cleanups: Cleanup[],
) {
  let eventsByType = new Map<string, EventDescriptor<Target>[]>()

  for (let descriptor of descriptors) {
    if (!eventsByType.has(descriptor.type)) {
      eventsByType.set(descriptor.type, [])
    }
    eventsByType.get(descriptor.type)!.push(descriptor)
  }

  for (let [type, descriptors] of eventsByType) {
    attach(target, type, descriptors, cleanups)
  }
}

function attachInteractions<Target extends EventTarget>(
  target: Target,
  descriptors: InteractionDescriptor<Target>[],
  cleanups: Cleanup[],
) {
  let byType = new Map<string, InteractionDescriptor<Target>[]>()

  for (let descriptor of descriptors) {
    if (!byType.has(descriptor.type)) {
      byType.set(descriptor.type, [])
    }
    byType.get(descriptor.type)!.push(descriptor)
  }

  for (let [type, descriptors] of byType) {
    attach(target, type, descriptors, cleanups)
  }
}

function attachAllEvents<Target extends EventTarget>(
  target: Target,
  descriptors: EventDescriptor<Target>[],
  cleanups: Cleanup[],
) {
  let { custom, standard } = splitDescriptors(descriptors)
  prepareInteractions(target, custom, cleanups)
  attachInteractions(target, custom, cleanups)
  attachStandardEvents(target, standard, cleanups)
}

function splitDescriptors<Target extends EventTarget>(
  descriptors: EventDescriptor<Target>[],
): {
  custom: InteractionDescriptor<Target>[]
  standard: EventDescriptor<Target>[]
} {
  let custom: InteractionDescriptor[] = []
  let standard: EventDescriptor[] = []
  for (let descriptor of descriptors) {
    if (isInteractionDescriptor(descriptor)) {
      custom.push(descriptor)
    } else {
      standard.push(descriptor)
    }
  }
  return { custom, standard }
}

function isInteractionDescriptor(descriptor: EventDescriptor): descriptor is InteractionDescriptor {
  return descriptor.isCustom === true
}

function descriptorsChanged<Target extends EventTarget>(
  descriptors: EventDescriptor<Target>[],
  nextDescriptors: EventDescriptor<Target>[],
): boolean {
  if (descriptors.length !== nextDescriptors.length) {
    return true
  }

  for (let i = 0; i < descriptors.length; i++) {
    let current = descriptors[i]
    let next = nextDescriptors[i]

    if (
      current.type !== next.type ||
      current.isCustom !== next.isCustom ||
      !shallowEqual(current.options, next.options) ||
      !shallowEqual((current as any).factoryOptions, (next as any).factoryOptions)
    ) {
      return true
    }
  }

  return false
}

function updateHandlersInPlace<Target extends EventTarget>(
  descriptors: EventDescriptor<Target>[],
  nextDescriptors: EventDescriptor<Target>[],
) {
  for (let i = 0; i < nextDescriptors.length; i++) {
    descriptors[i].handler = nextDescriptors[i].handler
  }
}

function cleanupAll(cleanups: Cleanup[]) {
  for (let cleanup of cleanups) cleanup()
}
