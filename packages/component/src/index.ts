/// <reference types="dom-navigation" preserve="true" />

// -- Roots --
export { run } from './lib/run.ts'
export type { AppRuntime, AppRuntimeEventMap, RunInit } from './lib/run.ts'
export type { ComponentErrorEvent } from './lib/error-event.ts'

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
export type { LoadModule, ResolveFrame } from './lib/frame.ts'

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
export type { MixinDescriptor, MixinHandle, MixinType, MixInput, MixValue } from './lib/mixin.ts'
export { TypedEventTarget } from './lib/typed-event-target.ts'
export { addEventListeners } from './lib/event-listeners.ts'
export { on } from './lib/mixins/on-mixin.ts'
export type { Dispatched } from './lib/mixins/on-mixin.ts'
export { link } from './lib/mixins/link-mixin.ts'
export { keys as keysEvents } from './lib/mixins/keys-mixin.ts'
export { pressEvents } from './lib/mixins/press-mixin.ts'
export type { PressEvent } from './lib/mixins/press-mixin.ts'
export { ref } from './lib/mixins/ref-mixin.ts'
export type { RefCallback } from './lib/mixins/ref-mixin.ts'
export { attrs } from './lib/mixins/attrs-mixin.ts'
export { css } from './lib/mixins/css-mixin.ts'
export { animateEntrance, animateExit } from './lib/mixins/animate-mixins.ts'
export { animateLayout } from './lib/mixins/animate-layout-mixin.ts'

// -- Animation --
export { spring } from './lib/spring.ts'
export type { SpringIterator, SpringPreset, SpringOptions } from './lib/spring.ts'

export { tween, easings } from './lib/tween.ts'
export type { TweenOptions, BezierCurve } from './lib/tween.ts'

// -- Navigation --
export { navigate } from './lib/navigation.ts'
export type { NavigationOptions } from './lib/navigation.ts'
