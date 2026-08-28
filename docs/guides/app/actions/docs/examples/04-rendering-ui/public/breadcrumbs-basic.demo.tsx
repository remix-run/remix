import { Breadcrumbs } from "remix/ui/breadcrumbs";

/**
 * @name Breadcrumbs Basic
 * @description A basic breadcrumb trail linking back through the page hierarchy.
 * @layout center
 */
export function BreadcrumbsBasic() {
  return () => (
    <Breadcrumbs
      items={[
        { href: "/", label: "Home" },
        { href: "/components", label: "Components" },
        { label: "Breadcrumbs" },
      ]}
    />
  );
}
