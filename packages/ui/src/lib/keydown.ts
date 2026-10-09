import { createMixin, on } from '@remix-run/component'

export const onKeyDown = createMixin<
  HTMLElement,
  [key: string, handler: (event: KeyboardEvent) => void]
>(
  () => (key, handler) =>
    on('keydown', (event) => {
      if (event.key === key) {
        event.preventDefault()
        handler(event)
      }
    }),
)
