import { Breadcrumbs } from '@remix-run/ui/breadcrumbs'
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
