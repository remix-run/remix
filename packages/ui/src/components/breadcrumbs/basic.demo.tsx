import { Breadcrumbs } from '@remix-run/ui/components/breadcrumbs'

/**
 * @name Breadcrumbs Basic
 * @description A basic breadcrumb trail linking back through the page hierarchy.
 * @layout center
 */
export default function Example() {
  return () => (
    <Breadcrumbs
      items={[
        { href: '/', label: 'Home' },
        { href: '/components', label: 'Components' },
        { label: 'Breadcrumbs' },
      ]}
    />
  )
}
