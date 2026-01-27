export { createRoot } from './lib/vdom.ts'

export { createElement } from './lib/create-element.ts'

export {
  Fragment,
  // Catch,
  // Frame,
} from './lib/component.ts'

// Export types from jsx.ts
export type {
  ElementType,
  ElementProps,
  RemixElement,
  Renderable,
  RemixNode,
  Props,
} from './lib/jsx.ts'

// Export types from dom.ts
export type {
  HostProps,
  LayoutAnimationConfig,
  PresenceStyleProperties,
  PresenceKeyframe,
  PresenceOptions,
  PresenceConfig,
  PresenceKeyframeConfig,
  AnimateProp,
} from './lib/dom.ts'

// Export types from vdom.ts
export type { VirtualRoot, VirtualRootOptions } from './lib/vdom.ts'

// Export types from component.ts
export type { Handle } from './lib/component.ts'

export { spring, type SpringIterator, type SpringPreset, type SpringOptions } from './lib/spring.ts'

export { tween, easings, type TweenOptions, type BezierCurve } from './lib/tween.ts'
