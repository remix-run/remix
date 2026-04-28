import { Button } from '@remix-run/ui/button'
import { buttonScrollRowCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <Button tone="primary" type="submit">
        Save
      </Button>
      <Button tone="secondary">Secondary</Button>
      <Button tone="ghost">Ghost</Button>
      <Button tone="danger">Delete</Button>
    </div>
  )
}
