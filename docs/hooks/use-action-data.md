---
title: useActionData
toc: false
---

# `useActionData`

Returns the serialized data from the most recent route action or undefined if there isn't one.

```tsx lines=[9,13]
import type { ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";

export async function action({
  request,
}: ActionFunctionArgs) {
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

- [Form Validation][form-validation]

**Related API**

- [`action`][action]
- [`useNavigation`][usenavigation]

**Discussions**

- [Fullstack Data Flow][fullstack-data-flow]

[action]: ../route/action
[usenavigation]: ../hooks/use-navigation
[rr-useactiondata]: https://reactrouter.com/hooks/use-action-data
[form-validation]: ../guides/form-validation
[fullstack-data-flow]: ../discussion/data-flow
