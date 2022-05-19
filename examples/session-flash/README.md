# Session Flash Example

You want to display a message after a request made from any component. [`session.flash()`](https://remix.run/docs/en/v1/api/remix#sessionflashkey-value) from the [Remix Session API](https://remix.run/docs/en/v1/api/remix#session-api) allows you to share ephemeral data with other components without relaying on Javascript or your database. Session data stored with `session.flash()` is only kept for a single request.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/session-flash)

## Example

This example shows how to create a simple alert message. Check [app/routes/index.tsx](app/routes/index.tsx) to see the flash message in action:

Implementation logic:

- A Remix `<Form>` sends a POST request to the server with the message to display.
- The `session.flash()` method sets session values that will be unset the first time it is read.
- The `loader` function sends the session flash values to the client.
- The [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) HTML element displays a dismissible alert.

The relevant files for this example are:

```
.
├── app
    └── routes
        └── index.tsx        # Main file
    └── utils
        └── session.ts       # Creates the session and gets the flash values
```

Setting the message with a form is used here for demonstration purpose. In an actual app, the message would be conditionnaly set on the server, typically to indicate that a request was successfully processed or that something went wrong. Adding additionnal informations, like color or severity, allows to dynamically style the displayed message.

## Related Links

- [`<Form>` in the Remix Docs](https://remix.run/docs/en/v1/api/remix#form)
- [session.flash() in the Remix Docs](https://remix.run/docs/en/v1/api/remix#sessionflashkey-value)
- ["`<dialog>`: The Dialog element" in the MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
