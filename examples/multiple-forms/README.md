# Multiple Forms

Each route only has one action that handles all forms for that route. To disambiguate the form that was submitted, you have several options. You can use a input with `type="hidden"` that has a `name` and `value` that's unique to the action you want taken, or you can use a `name` and `value` on the submit button (note, a single form can also have multiple submit buttons this way). Then, all your action function needs to do is get the intended action from that field value.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/multiple-forms)

## Example

We have a page with invitations to a party. We display who the invitation was sent to along with when the invitation was sent. You can create new invitations and resend or delete existing invitations. So this single route has many forms on the page and each uses a `_action` field to specify the action to take (this is just a convention, the name doesn't matter).

## Related Links

- [Actions](https://remix.run/docs/en/v1/api/conventions#action)
