import { Breadcrumbs } from '@remix-run/ui/breadcrumbs'
export default function example() {
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
