import { createElement } from '@remix-run/ui'
import type { Handle, Props, RemixElement } from '@remix-run/ui'

type IconProps = Omit<Props<'svg'>, 'children'>

function icon(handle: Handle<IconProps>, children: RemixElement): RemixElement {
  return createElement(
    'svg',
    {
      ...handle.props,
      'aria-hidden': handle.props['aria-hidden'] ?? true,
      fill: 'none',
      viewBox: '0 0 16 16',
      xmlns: 'http://www.w3.org/2000/svg',
    },
    children,
  )
}

export function SearchIcon(handle: Handle<IconProps>): () => RemixElement {
  return () =>
    icon(
      handle,
      createElement('path', {
        d: 'M7.25 12.25a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm3.54-1.46 3 3',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
    )
}
