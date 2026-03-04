// -- Roots --
export { run } from './lib/run.ts'
export type { AppRuntime, RunInit, LoadModule, ResolveFrame } from './lib/run.ts'

export { createRoot, createRangeRoot, createScheduler } from './lib/vdom.ts'
export type { VirtualRoot, VirtualRootEventMap, VirtualRootOptions, Scheduler } from './lib/vdom.ts'

export type { StyleManager } from './lib/style/index.ts'
export type { CSSProps } from './lib/style/lib/style.ts'
export { createStyleManager } from './lib/style/lib/stylesheet.ts'

export type { CommittedComponentNode, VNode } from './lib/vnode.ts'
export type { EmptyFn, SchedulerPhaseType, SchedulerPhaseListener } from './lib/scheduler.ts'

// -- Client Entries --
export { clientEntry } from './lib/client-entries.ts'
export type {
  SerializablePrimitive,
  SerializableObject,
  SerializableArray,
  SerializableValue,
  SerializableProps,
  EntryComponent,
  EntryMetadata,
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
  NoContext,
  ContextFrom,
  FragmentProps,
  Component,
  ComponentHandle,
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
export type {
  MixinDescriptor,
  MixinHandle,
  MixinType,
  MixValue,
  MixinHandleEventMap,
  MixinElement,
  RebindTuple,
  RebindNode,
  MixinRuntimeType,
  MixinInsertEvent,
  MixinReclaimedEvent,
  MixinUpdateEvent,
  MixinBeforeRemoveEvent,
  MixinProps,
} from './lib/mixin.ts'
export { TypedEventTarget } from './lib/typed-event-target.ts'
export type { TypedEventListener } from './lib/typed-event-target.ts'
export { addEventListeners } from './lib/event-listeners.ts'
export type { EventListeners } from './lib/event-listeners.ts'
export { on } from './lib/mixins/on-mixin.tsx'
export type { Dispatched, EventType, ListenerFor, SignaledListener } from './lib/mixins/on-mixin.tsx'
export { keysEvents, baseKeysEvents } from './lib/mixins/keys-mixin.tsx'
export {
  escapeEventType,
  enterEventType,
  spaceEventType,
  backspaceEventType,
  deleteEventType,
  arrowLeftEventType,
  arrowRightEventType,
  arrowUpEventType,
  arrowDownEventType,
  homeEventType,
  endEventType,
  pageUpEventType,
  pageDownEventType,
} from './lib/mixins/keys-mixin.tsx'
export type { KeysEventsMixin } from './lib/mixins/keys-mixin.tsx'
export { pressEvents, basePressEvents } from './lib/mixins/press-mixin.tsx'
export {
  pressEventType,
  pressDownEventType,
  pressUpEventType,
  longPressEventType,
  pressCancelEventType,
} from './lib/mixins/press-mixin.tsx'
export type { PressEvent, PressEventsMixin } from './lib/mixins/press-mixin.tsx'
export { ref } from './lib/mixins/ref-mixin.tsx'
export type { RefCallback } from './lib/mixins/ref-mixin.tsx'
export { css } from './lib/mixins/css-mixin.tsx'
export { animateEntrance, animateExit } from './lib/mixins/animate-mixins.tsx'
export type { AnimationConfig, AnimateMixinConfig } from './lib/mixins/animate-mixins.tsx'
export { animateLayout } from './lib/mixins/animate-layout-mixin.tsx'
export type { LayoutConfig } from './lib/mixins/animate-layout-mixin.tsx'

// -- Animation --
export { spring } from './lib/spring.ts'
export type { SpringIterator, SpringPreset, SpringOptions } from './lib/spring.ts'

export { tween, easings } from './lib/tween.ts'
export type { TweenOptions, BezierCurve } from './lib/tween.ts'
