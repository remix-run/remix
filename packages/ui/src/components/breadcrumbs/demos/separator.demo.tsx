import { Breadcrumbs } from '@remix-run/ui/breadcrumbs'

/**
 * @name Breadcrumbs with Separator
 * @description Pass a custom separator string to override the default chevron icon.
 */
export default function Example() {
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
