import 'remix/ui'
import { HostProps } from 'remix/ui'

type JUISize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type JUIBorderType = 'all' | 'top' | 'right' | 'bottom' | 'left'
type JUIVariant = 'neutral' | 'primary' | 'secondary' | 'accent' | 'muted' | 'error'

interface JUIHostProps {
  aspect?: 'square' | 'video' | 'golden' | 'portrait'
  bg?: 'primary' | 'secondary' | 'accent' | 'sheet' | 'transparent' | 'muted' | 'error' | 'neutral'
  border?: JUIBorderType | string
  font?: JUISize
  gap?: JUISize
  grow?: boolean
  hide?: 'desktop' | 'tablet' | 'mobile'
  show?: 'desktop' | 'tablet' | 'mobile'
  items?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
  m?: JUISize
  mt?: JUISize
  mr?: JUISize
  mb?: JUISize
  ml?: JUISize
  notypography?: boolean
  p?: JUISize
  pt?: JUISize
  pr?: JUISize
  pb?: JUISize
  pl?: JUISize
  scrollx?: boolean
  scrolly?: boolean
  sticky?: boolean
  truncate?: boolean
  typography?: boolean
  weight?: 'lighter' | 'normal' | 'bolder'
  h?: 'screen'
  minh?: 'screen'
  w?: 'full' | JUISize
  maxw?: 'prose' | 'full' | JUISize
}

declare module 'remix/ui' {
  interface HostProps<eventTarget extends EventTarget> extends JUIHostProps {}
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'jui-alert': HostProps<HTMLElement> & {
        variant?: JUIVariant
      }
      'jui-badge': HostProps<HTMLElement> & {
        variant?: JUIVariant
      }
      'jui-button': HostProps<HTMLElement> & {
        size?: JUISize | 'icon' | `icon-${Exclude<JUISize, 'md'>}`
        variant?: JUIVariant
      }
      'jui-card': HostProps<HTMLElement>
      'jui-card-header': HostProps<HTMLElement>
      'jui-card-body': HostProps<HTMLElement>
      'jui-card-footer': HostProps<HTMLElement>
      'jui-container': HostProps<HTMLElement> & {
        center?: boolean
      }
      'jui-drawer': HostProps<HTMLElement> & {
        position?: 'right'
        show?: 'tablet' | 'desktop'
      }
      'jui-drawer-header': HostProps<HTMLElement>
      'jui-drawer-body': HostProps<HTMLElement>
      'jui-drawer-footer': HostProps<HTMLElement>
      'jui-field': HostProps<HTMLElement> & {
        invalid?: boolean
        size?: JUISize
      }
      'jui-group': HostProps<HTMLElement> & {
        nowrap?: boolean
      }
      'jui-modal': HostProps<HTMLElement>
      'jui-modal-header': HostProps<HTMLElement>
      'jui-modal-body': HostProps<HTMLElement>
      'jui-modal-footer': HostProps<HTMLElement>
      'jui-stack': HostProps<HTMLElement>
    }
  }
}
