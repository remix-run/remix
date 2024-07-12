---
title: useActionData
toc: false
---

# `useActionData`

Returns the serialized data from the [route action](../route/action.md) where this hook is called. It returns `undefined` if there's no `action` defined.

**Important**: This hook cannot access data from actions defined in parent or child routes.

```tsx lines=[10,14]
import type { ActionFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import { Form, useActionData } from "@remix-run/react";

export async function action({
  request,
}: ActionFunctionArgs) {
  const body = await request.formData();
  const name = body.get("visitorsName");
  return json({ message: `Hello, ${name}` });
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

- [Form Validation][form_validation]

**Related API**

- [`action`][action]
- [`useNavigation`][use_navigation]

**Discussions**

- [Fullstack Data Flow][fullstack_data_flow]

[form_validation]: ../guides/form-validation
[action]: ../route/action
[use_navigation]: ../hooks/use-navigation
[fullstack_data_flow]: ../discussion/data-flow
