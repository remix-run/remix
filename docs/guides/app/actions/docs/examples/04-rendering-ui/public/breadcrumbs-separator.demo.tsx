import { Breadcrumbs } from "remix/ui/breadcrumbs";

/**
 * @name Breadcrumbs with Separator
 * @description Pass a custom separator string to override the default chevron icon.
 * @layout center
 */
export function BreadcrumbsSeparator() {
  return () => (
    <Breadcrumbs
      items={[
        { href: "/", label: "Workspace" },
        { href: "/projects", label: "Projects" },
        { label: "Components" },
      ]}
      separator="/"
    />
  );
}
