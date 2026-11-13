export type IdScope = {
  createComponentId(): string
  createMixinId(): string
}

/**
 * Creates IDs for the components and mixin hosts of one hydration root. The server and the client
 * allocate them in the same render order, so an ID is the same before and after hydration.
 *
 * @param prefix Identifies the root. The first component keeps it as its ID.
 * @returns An allocator for the root's component and mixin IDs.
 */
export function createIdScope(prefix: string): IdScope {
  let components = 0
  let mixins = 0
  return {
    createComponentId: () => (components++ === 0 ? prefix : `${prefix}-${components - 1}`),
    createMixinId: () => `${prefix}-m${++mixins}`,
  }
}
