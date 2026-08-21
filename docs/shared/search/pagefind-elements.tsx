/// <reference path="./pagefind.d.ts" />

import type { Handle } from 'remix/ui'

export interface PagefindElementsProps {
  baseUrl: string
  bundlePath: string
}

/**
 * Pagefind config + modal custom elements shared by the docs sites.
 *
 * Sites still own head link/script tags (paths differ with versioning).
 */
export function PagefindElements(handle: Handle<PagefindElementsProps>) {
  return () => (
    <>
      <pagefind-config
        base-url={handle.props.baseUrl}
        bundle-path={handle.props.bundlePath}
      ></pagefind-config>
      <pagefind-modal
        data-rmx-key="pagefind-modal"
        data-rmx-preserve-dom
        reset-on-close
      ></pagefind-modal>
    </>
  )
}
