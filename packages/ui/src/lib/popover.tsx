import { createMixin, on, type ElementProps } from '@remix-run/component'

import { anchor, type AnchorOptions } from './anchor.ts'
import { ui } from './theme.ts'

export let popover = createMixin<HTMLElement, [options?: AnchorOptions], ElementProps>((handle) => {
  let cleanupAnchor = () => {}
  let currentId = ''
  let currentOptions: AnchorOptions = {}
  type PopoverMixinArgs =
    | [props: ElementProps]
    | [options: AnchorOptions | undefined, props: ElementProps]

  function anchorToOwner(node: HTMLElement) {
    let owner = document.querySelector(`[popovertarget="${currentId}"]`)
    if (!(owner instanceof HTMLElement)) {
      console.warn(`No popover owner found for #${currentId}`)
      return
    }

    cleanupAnchor()
    cleanupAnchor = anchor(node, owner, currentOptions)
  }

  handle.addEventListener('remove', cleanupAnchor)

  return (...args: PopoverMixinArgs) => {
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
            if (event.newState === 'open') {
              anchorToOwner(event.currentTarget)
            }
          }),
          on('toggle', (event) => {
            if (event.newState === 'closed') {
              cleanupAnchor()
              cleanupAnchor = () => {}
            }
          }),
        ]}
      />
    )
  }
})
