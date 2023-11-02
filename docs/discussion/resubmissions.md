---
title: Form Resubmissions
---

# Form Resubmissions

When you use `<Form method="post">` in Remix, as opposed to using the native HTML `<form method="post">`, Remix does not adhere to the default browser behavior for resubmitting forms during navigation events like clicking back, forward, or refreshing.

## The Browser's Default Behavior

In a standard browser environment, form submissions are navigation events. This means that when a user clicks the back button, the browser will typically resubmit the form. For example:

1. User visits `/buy`
2. Submits a form to `/checkout`
3. Navigates to `/order/123`

The browser history stack would look like this:

```
GET /buy > POST /checkout > *GET /order/123
```

If the user clicks the back button, the history becomes:

```
GET /buy - *POST /checkout < GET /order/123
```

In this situation, the browser resubmits the form data, which could lead to issues such as charging a credit card twice.

## Redirecting from `action`s

A common practice to avoid this issue is to issue a redirect after the POST request. This removes the POST action from the browser's history. The history stack would then look like this:

```
GET /buy > POST /checkout, Redirect > GET /order/123
```

With this approach, clicking the back button would not resubmit the form:

```
GET /buy - *GET /order/123
```

## Specific Scenarios to Consider

While accidental resubmissions generally don't happen in Remix, there are specific scenarios where they might.

- You used `<form>` instead of `<Form>`
- You used `<Form reloadDocument>`
- You are not rendering `<Scripts/>`
- JavaScript is disabled by the user
- JavaScript had not loaded when the form was submitted

It's advisable to implement a redirect from the action to avoid unintended resubmissions.

## Additional Resources

**Guides**

- [Form Validation][form_validation]

**API**

- [`<Form>`][form]
- [`useActionData`][use_action_data]
- [`redirect`][redirect]

[form_validation]: ../guides/form-validation
[form]: ../components/form
[use_action_data]: ../hooks/use-action-data
[redirect]: ../utils/redirect
