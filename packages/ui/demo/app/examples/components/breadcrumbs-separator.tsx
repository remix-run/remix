import { Breadcrumbs } from 'remix/ui'

export default function example() {
  return () => (
    <Breadcrumbs
      items={[
        { href: '/', label: 'Workspace' },
        { href: '/projects', label: 'Projects' },
        { label: 'RMX_01' },
      ]}
      separator="/"
    />
  )
}
