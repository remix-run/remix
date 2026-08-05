import type { Handle } from 'remix/ui'

export type IconName =
  | 'check-mark'
  | 'chevron-d'
  | 'chevron-r'
  | 'chevrons-up-down'
  | 'circle-minus'
  | 'circle-plus'
  | 'circle-x'
  | 'copy'
  | 'discord'
  | 'download'
  | 'edit'
  | 'fast-forward'
  | 'github'
  | 'layout-left'
  | 'menu'
  | 'monitor'
  | 'moon'
  | 'search'
  | 'sun'
  | 'x'
  | 'x-mark'
  | 'youtube'

export interface IconProps {
  name: IconName
}

export function Icon(handle: Handle<IconProps>) {
  return () => (
    <svg aria-hidden="true" focusable="false">
      <use href={`/icons.svg#${handle.props.name}`} />
    </svg>
  )
}
