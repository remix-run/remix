import { Breadcrumbs } from "remix/components/breadcrumbs";

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
