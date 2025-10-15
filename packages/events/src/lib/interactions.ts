import type { EventHandler, EventDescriptor, Cleanup } from './events.ts'

export type InteractionFactory<
  Target extends EventTarget = EventTarget,
  Detail = any,
  Options = any,
> = (
  context: {
    dispatch: (options?: CustomEventInit<Detail>, originalEvent?: Event) => void
    target: Target
  },
  options?: Options,
) => Cleanup | Cleanup[] | void

export interface InteractionDescriptor<Target extends EventTarget = EventTarget>
  extends EventDescriptor<Target> {
  factory: InteractionFactory<Target>
  factoryOptions?: any
}

export type Interaction<Target extends EventTarget = EventTarget, Detail = any> = {
  <ECurrentTarget extends EventTarget = Target>(
    handler: EventHandler<CustomEvent<Detail>, ECurrentTarget>,
    options?: any,
  ): InteractionDescriptor<ECurrentTarget>
}

function createEventNameWithOptions(baseName: string, options?: any): string {
  if (!options || Object.keys(options).length === 0) {
    return baseName
  }

  let params = new URLSearchParams()
  // Sort keys for consistent ordering
  let sortedKeys = Object.keys(options).sort()
  for (let key of sortedKeys) {
    params.append(key, String(options[key]))
  }

  return `${baseName}?${params.toString()}`
}

export function createInteraction<Target extends EventTarget, Detail = any, Options = any>(
  eventName: string,
  factory: InteractionFactory<Target, Detail, Options>,
): Interaction<Target, Detail> {
  return <ECurrentTarget extends EventTarget = Target>(
    handler: EventHandler<CustomEvent<Detail>, ECurrentTarget>,
    options?: Options,
  ) => {
    let finalEventName = createEventNameWithOptions(eventName, options)

    return {
      type: finalEventName,
      handler: handler as EventHandler<any, ECurrentTarget>,
      isCustom: true,
      factoryOptions: options,
      factory: factory as any,
    }
  }
}
