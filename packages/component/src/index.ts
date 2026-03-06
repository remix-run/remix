// -- Roots --
export { run } from './lib/run.ts'
export type { AppRuntime, RunInit } from './lib/run.ts'

export { createRoot, createRangeRoot, createScheduler } from './lib/vdom.ts'
export type { VirtualRoot, VirtualRootEventMap, VirtualRootOptions, Scheduler } from './lib/vdom.ts'

// -- Client Entries --
export { clientEntry } from './lib/client-entries.ts'
export type {
  SerializablePrimitive,
  SerializableObject,
  SerializableArray,
  SerializableValue,
  SerializableProps,
  EntryComponent,
} from './lib/client-entries.ts'

// -- Components --
export { Fragment, Frame } from './lib/component.ts'
export type {
  Task,
  Handle,
  Context,
  FrameHandleEventMap,
  FrameContent,
  FrameHandle,
  FrameProps,
} from './lib/component.ts'

// -- Elements/JSX/Props --
export { createElement } from './lib/create-element.ts'
export type {
  ElementType,
  ElementProps,
  RemixElement,
  Renderable,
  RemixNode,
  Props,
} from './lib/jsx.ts'
export type { HostProps, LayoutAnimationConfig } from './lib/dom.ts'
export { createMixin } from './lib/mixin.ts'
export type { MixinDescriptor, MixinHandle, MixinType, MixValue } from './lib/mixin.ts'
export { TypedEventTarget } from './lib/typed-event-target.ts'
export { addEventListeners } from './lib/event-listeners.ts'
export { on } from './lib/mixins/on-mixin.tsx'
export type { Dispatched } from './lib/mixins/on-mixin.tsx'
export { keysEvents } from './lib/mixins/keys-mixin.tsx'
export { pressEvents } from './lib/mixins/press-mixin.tsx'
export type { PressEvent } from './lib/mixins/press-mixin.tsx'
export { ref } from './lib/mixins/ref-mixin.tsx'
export type { RefCallback } from './lib/mixins/ref-mixin.tsx'
export { css } from './lib/mixins/css-mixin.tsx'
export { animateEntrance, animateExit } from './lib/mixins/animate-mixins.tsx'
export { animateLayout } from './lib/mixins/animate-layout-mixin.tsx'

// -- Animation --
export { spring } from './lib/spring.ts'
export type { SpringIterator, SpringPreset, SpringOptions } from './lib/spring.ts'

export { tween, easings } from './lib/tween.ts'
export type { TweenOptions, BezierCurve } from './lib/tween.ts'
