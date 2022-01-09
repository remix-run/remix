# GDPR Cookie Consent

Create a simple GDPR consent form.
Till the user doesn't click on the `Accept` button, she will see a banner prompting to accept cookies.


## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/gdpr-cookie-consent)

## Example

Users will be presented with a GDPR consent form on every page [app/root.tsx](app/root.tsx) till they submit the accept button.
Once they submit the consent form, a dummy tracking [script](public/dummy-analytics-script.js) at the [app/root.tsx](app/root.tsx)  will start tracking the user`s data (open the browser console too see the dummy tracking message).

> If you want to reset the example delete the `gdpr-consent` cookie in the `Application`/`cookies` in the browser's developer tools.

The example is using [Remix Cookie API](https://remix.run/docs/en/v1/api/remix#cookies).



## Related Links

- https://remix.run/docs/en/v1/api/remix#cookies
- https://en.wikipedia.org/wiki/General_Data_Protection_Regulation
