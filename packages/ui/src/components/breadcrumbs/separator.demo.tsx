import { Breadcrumbs } from '@remix-run/ui/components/breadcrumbs'

/**
 * @name Breadcrumbs with Separator
 * @description Pass a custom separator string to override the default chevron icon.
 * @layout center
 */
export default function Example() {
  return () => (
    <Breadcrumbs
      items={[
        { href: '/', label: 'Workspace' },
        { href: '/projects', label: 'Projects' },
        { label: 'Components' },
      ]}
      separator="/"
    />
  )
}
