---
title: useActionData
toc: false
---

# `useActionData`

Returns the serialized data from the most recent route action or undefined if there isn't one.

```tsx lines=[7,11]
import type { ActionArgs } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";

export async function action({ request }: ActionArgs) {
  const body = await request.formData();
  const name = body.get("visitorsName");
  return { message: `Hello, ${name}` };
}

export default function Invoices() {
  const data = useActionData<typeof action>();
  return (
    <Form method="post">
      <input type="text" name="visitorsName" />
      {data ? data.message : "Waiting..."}
    </Form>
  );
}
```

## Additional Resources

**Guides**

- [Form Validation](../guides/form-validation)

**Related API**

- [`action`][action]
- [`useNavigation`][usenavigation]

**Discussions**

- [Fullstack Data Flow](../discussion/03-data-flow)

[action]: ../route/action
[usenavigation]: ../hooks/use-navigation
[rr-useactiondata]: https://reactrouter.com/hooks/use-action-data
