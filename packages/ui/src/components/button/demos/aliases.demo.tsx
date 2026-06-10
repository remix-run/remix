import { Button } from '@remix-run/ui/components/button'
import { css } from '@remix-run/ui'

/**
 * @name Button Component
 * @description The Button component wraps the low-level style primitives and accepts a tone prop for quick theming.
 * @layout center
 * @order 2
 */
export default function Example() {
  return () => (
    <div mix={buttonRowCss}>
      <Button tone="primary" type="submit">
        Save
      </Button>
      <Button tone="secondary">Secondary</Button>
      <Button tone="ghost">Ghost</Button>
      <Button tone="danger">Delete</Button>
    </div>
  )
}

const buttonRowCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
})
