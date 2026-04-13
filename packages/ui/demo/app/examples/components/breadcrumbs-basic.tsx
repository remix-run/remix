import { Breadcrumbs } from 'remix/ui'

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
