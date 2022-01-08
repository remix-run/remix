# GDPR Cookie Consent

Create a simple GDPR consent form.
Till the user doesn't click on the `Accept` button, she will see a banner prompting to accept cookies.


## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

<!-- TODO: update this link to the path for your example: -->

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/remix-gdpr-example-e7znt?file=/app/routes/index.tsx)

## Example

Users will be presented with a GDPR consent form on every page ([app/routes/index.tsx](app/routes/index.tsx)) till they submit the accept button.
Once they submit the consent form, a dummy tracking [scripts](public/dummy-analytics-script.js) at the [app/root.tsx](app/root.tsx) will start tracking the user`s data (open the browser console too see the dummy tracking message).

The example is using Remix Cookie API

## Related Links

- https://remix.run/docs/en/v1/api/remix#cookies
- https://en.wikipedia.org/wiki/General_Data_Protection_Regulation
