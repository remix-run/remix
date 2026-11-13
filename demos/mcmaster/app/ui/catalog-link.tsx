import type { Handle, Props } from 'remix/component'

import { getSpeedSettings } from '../middleware/speed-settings.ts'
import { frames } from '../routes.ts'

export type CatalogLinkProps = Props<'a'> & {
  href: string
  /** Set to `false` for pages that are never cached, where a prefetch would be thrown away. */
  prefetch?: boolean
}

/**
 * A link that swaps only the page's content frame and starts loading its destination as soon as
 * the visitor hovers, focuses, or presses it. With the speed techniques off it renders a plain
 * link, so every click is a full document load.
 */
export function CatalogLink(handle: Handle<CatalogLinkProps>) {
  return () => {
    let { prefetch = true, ...props } = handle.props
    let { techniques } = getSpeedSettings()

    return (
      <a
        {...props}
        data-rmx-target={frames.content}
        data-rmx-prefetch={techniques && prefetch ? 'intent' : undefined}
      />
    )
  }
}
