import type { Handle, RemixNode, RenderFn } from './component.ts'

/**
 * Props accepted by the built-in {@link Fragment} component.
 */
export interface FragmentProps {
  /** Child nodes to render without adding an extra host element. */
  children?: RemixNode
}

/**
 * Built-in component used to group children without adding a host element.
 *
 * @param handle Component handle for the fragment instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export function Fragment(handle: Handle<FragmentProps>): RenderFn {
  void handle
  return () => null // reconciler renders
}
