# Outlet Form Rerender Remix Example

- [Remix Docs](https://remix.run/docs)

In this example, we we'll look at how to update a Form with uncontrolled fields during a nested route transition.

For example, when the form is rendered inside a nested route, changing the route from the parent route does not cause the form to unmount but should update the values of the fields.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/outlet-form-rerender)

## Example

Here we have a simple example where we list a set of users and, clicking on a user will open a form inside a nested route with details of the user prefilled.

You can check the explanation for the problem of updating the form with the updated values at [$userId.tsx](app/routes/users/$userId.tsx)

## Related links

- [React Uncontrolled Components](https://reactjs.org/docs/uncontrolled-components.html)
- [React Keys](https://reactjs.org/docs/lists-and-keys.html#keys)
