---
"remix": minor
"@remix-run/serve": minor
"@remix-run/server-runtime": minor
---

`MetaFunction` type can now infer `data` and `parentsData` types from loaders

For example, if this meta function is for `/sales/customers/$customerId`:

```ts
// app/root.tsx
const loader = () => {
  return json({ hello: "world" } as const)
}
export type Loader = typeof loader

// app/routes/sales.tsx
const loader = () => {
  return json({ salesCount: 1074 })
}
export type Loader = typeof loader

// app/routes/sales/customers.tsx
const loader = () => {
  return json({ customerCount: 74 })
}
export type Loader = typeof loader

// app/routes/sales/customers/$customersId.tsx
import type { Loader as RootLoader } from "../../../root"
import type { Loader as SalesLoader } from "../../sales"
import type { Loader as CustomersLoader } from "../../sales/customers"

const loader = () => {
  return json({ name: "Customer name" })
}

const meta: MetaFunction<typeof loader, {
  "root": RootLoader
  "routes/sales": SalesLoader,
  "routes/sales/customers": CustomersLoader,
}> = ({ data, parentsData }) => {
  const { name } = data
  //      ^? string
  const { customerCount } = parentsData["routes/sales/customers"]
  //      ^? number
  const { salesCount } = parentsData["routes/sales"]
  //      ^? number
  const { hello } = parentsData["root"]
  //      ^? "world"
}
