// @jsxRuntime classic
// @jsx jsx
import { createMixin } from '../mixin.ts'
import { jsx } from '../jsx.ts'
import { navigate } from '../navigation.ts'
import { on } from './on-mixin.tsx'
import type { ElementProps } from '../jsx.ts'

export type LinkOptions = {
  src?: string | null
  target?: string | null
  history?: 'push' | 'replace'
}

type LinkCurrentProps = ElementProps & {
  disabled?: boolean
  role?: string
  tabIndex?: number
  tabindex?: number
  type?: string
  contentEditable?: boolean | string
  contenteditable?: boolean | string
  'aria-disabled'?: boolean | 'true' | 'false'
}

let nativeLinkHostTypes = new Set(['a', 'area'])

export let link = createMixin<HTMLElement, [href: string, options?: LinkOptions], LinkCurrentProps>(
  (handle, hostType) => {
    let suppressKeyboardClick = false

    return (href, options, props: LinkCurrentProps) => {
      if (nativeLinkHostTypes.has(hostType)) {
        return (
          <handle.element
            {...props}
            href={href}
            {...(options?.target == null ? {} : { 'rmx-target': options.target })}
            {...(options?.src == null ? {} : { 'rmx-src': options.src })}
          />
        )
      }

      let nextProps = { ...props }
      if (nextProps.role == null) {
        nextProps.role = 'link'
      }
      if (nextProps.disabled === true && nextProps['aria-disabled'] == null) {
        nextProps['aria-disabled'] = 'true'
      }
      if (hostType === 'button' && nextProps.type == null) {
        nextProps.type = 'button'
      }
      if (
        hostType !== 'button' &&
        nextProps.tabIndex == null &&
        nextProps.tabindex == null &&
        nextProps.contentEditable == null &&
        nextProps.contenteditable == null
      ) {
        nextProps.tabIndex = 0
      }

      return (
        <handle.element
          {...nextProps}
          mix={[
            on('click', (event) => {
              if (event.detail === 0 && suppressKeyboardClick) {
                suppressKeyboardClick = false
                event.preventDefault()
                return
              }

              suppressKeyboardClick = false
              if (isDisabledElement(event.currentTarget)) {
                event.preventDefault()
                return
              }
              if (event.button !== 0) return

              event.preventDefault()
              if (event.metaKey || event.ctrlKey) {
                globalThis.open(href, '_blank')
                return
              }

              void navigate(href, options)
            }),
            on('auxclick', (event) => {
              suppressKeyboardClick = false
              if (isDisabledElement(event.currentTarget)) {
                event.preventDefault()
                return
              }
              if (event.button !== 1) return

              event.preventDefault()
              globalThis.open(href, '_blank')
            }),
            on('keydown', (event) => {
              if (event.key === 'Enter') {
                if (event.repeat) return
                if (isDisabledElement(event.currentTarget)) {
                  event.preventDefault()
                  return
                }

                suppressKeyboardClick = hostType === 'button'
                event.preventDefault()
                void navigate(href, options)
                return
              }

              if (hostType === 'button' && event.key === ' ') {
                suppressKeyboardClick = true
                event.preventDefault()
              }
            }),
            on('keyup', (event) => {
              if (hostType === 'button' && event.key === ' ') {
                event.preventDefault()
              }
            }),
          ]}
        />
      )
    }
  },
)

function isDisabledElement(node: Element) {
  return (
    ('disabled' in node && node.disabled === true) || node.getAttribute('aria-disabled') === 'true'
  )
}
