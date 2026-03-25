import { createMixin, renderMixinElement } from '../mixin.ts'
import { navigate } from '../navigation.ts'
import { on } from './on-mixin.ts'
import type { ElementProps } from '../jsx.ts'

import type { NavigationOptions } from '../navigation.ts'

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

/**
 * Adds client-side navigation behavior to anchor-like elements.
 */
export let link = createMixin<
  HTMLElement,
  [href: string, options?: NavigationOptions],
  LinkCurrentProps
>((handle, hostType) => {
  let suppressKeyboardClick = false

  return (href, options, props: LinkCurrentProps) => {
    if (nativeLinkHostTypes.has(hostType)) {
      return renderMixinElement(handle.element, {
        ...(props ?? {}),
        href,
        ...(options?.target == null ? {} : { 'rmx-target': options.target }),
        ...(options?.src == null ? {} : { 'rmx-src': options.src }),
        ...(options?.resetScroll === false ? { 'rmx-reset-scroll': 'false' } : {}),
      })
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

    return renderMixinElement(handle.element, {
      ...nextProps,
      mix: [
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
      ],
    })
  }
})

function isDisabledElement(node: Element) {
  return (
    ('disabled' in node && node.disabled === true) || node.getAttribute('aria-disabled') === 'true'
  )
}
