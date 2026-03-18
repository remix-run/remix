// @jsxRuntime classic
// @jsx createElement
import {
  createElement,
  createMixin,
  on,
  type ElementProps,
} from '@remix-run/component'

import { anchor, type AnchorOptions } from './anchor.ts'
import { ui } from './theme.ts'

export let popover = createMixin<HTMLElement, [options?: AnchorOptions], ElementProps>((handle) => {
  let cleanupAnchor = () => {}
  let currentId = ''
  let currentOptions: AnchorOptions = {}
  type PopoverRunnerArgs =
    | [props: ElementProps]
    | [options: AnchorOptions | undefined, props: ElementProps]

  function anchorToOwner(node: HTMLElement) {
    cleanupAnchor()
    cleanupAnchor = () => {}

    let owner = document.querySelector(`[popovertarget="${currentId}"]`)
    if (!(owner instanceof HTMLElement)) {
      console.warn(`No popover owner found for #${currentId}`)
      return
    }

    cleanupAnchor = anchor(node, owner, currentOptions)
  }

  handle.addEventListener('insert', (event) => {
    anchorToOwner(event.node)
  })

  handle.addEventListener('remove', () => {
    cleanupAnchor()
    cleanupAnchor = () => {}
  })

  return (...args: PopoverRunnerArgs) => {
    let options = args.length === 2 ? args[0] : undefined
    let props = args.length === 2 ? args[1] : args[0]
    currentOptions = options ?? {}

    props.id ??= handle.id

    currentId = props.id

    props.popover ??= 'manual'

    return (
      <handle.element
        {...props}
        mix={[
          ui.popover.surface,
          on('beforetoggle', (event) => {
            let toggleEvent = event as Event & { newState?: 'open' | 'closed' }
            if (toggleEvent.newState === 'open') {
              anchorToOwner(event.currentTarget)
            }
          }),
          on('toggle', (event) => {
            let toggleEvent = event as Event & { newState?: 'open' | 'closed' }
            if (toggleEvent.newState === 'closed') {
              cleanupAnchor()
              cleanupAnchor = () => {}
            }
          }),
        ]}
      />
    )
  }
})
