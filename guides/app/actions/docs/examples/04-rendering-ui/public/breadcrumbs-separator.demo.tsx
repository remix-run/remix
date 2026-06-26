import { Breadcrumbs } from "remix/components/breadcrumbs";

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
