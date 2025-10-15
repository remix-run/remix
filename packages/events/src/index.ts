import type { EventDescriptor } from './lib/events.ts'

// Core functions
export { events, bind } from './lib/events.ts'
export { dom, xhr, win, doc, ws } from './lib/targets.ts'
export { createInteraction } from './lib/interactions.ts'
export { createEventType } from './lib/event-type.ts'

export type { EventContainer, EventHandler, EventDescriptor, Cleanup } from './lib/events.ts'

export type { InteractionDescriptor, InteractionFactory, Interaction } from './lib/interactions.ts'

/**
 * A type that describes any object that can create event descriptors.
 * This includes:
 * - `dom.click`, `dom.pointermove`, etc. (target event functions)
 * - `press`, `pressDown`, etc. (interaction functions)
 * - `bind` (raw event binding function)
 */
export type EventBinder = (...args: any[]) => EventDescriptor<any>
