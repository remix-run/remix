# Welcome to Remix

- [Remix Docs](https://remix.run/docs)

In this example, we will be looking at how to update a Form with uncontrolled fields with the updated values when the form does not unmount between transitions.

For example, when the form is rendered inside a nested route, changing the route from the parent route does not cause the form to unmount but updates the values of the fields.

## Example

Here we have a simple example where we list a set of users and, clicking on a user will open a form inside a nested route with details of the user prefilled.

You can check the explanation for the problem of updating the form with the updated values at [$userId.tsx](app/routes/users/$userId.tsx)

## Related links

- [React Uncontrolled Components](https://reactjs.org/docs/uncontrolled-components.html)
- [React Keys](https://reactjs.org/docs/lists-and-keys.html#keys)
