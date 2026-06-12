import { css } from '@remix-run/ui'
import button from '@remix-run/ui/button'

/**
 * @name Button Basic
 * @description The button mixin applies neutral or primary pill styling to button-like hosts.
 * @layout center
 */
export default function Example() {
  return () => (
    <div mix={buttonGridCss}>
      <button mix={button()}>Edit order</button>
      <button mix={button({ size: 'lg' })}>Export</button>
      <button mix={button({ tone: 'primary' })}>Save changes</button>
      <button mix={button({ size: 'lg', tone: 'primary' })}>Create project</button>
    </div>
  )
}

const buttonGridCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  maxWidth: '22rem',
})
