---
"remix": minor
"@remix-run/testing": minor
---

Remove the `unstable_` prefix from `createRemixStub`. After real-world experience, we're confident in the API and ready to commit to it.

- Note: This involves 1 small breaking change. The `<RemixStub remixConfigFuture>` prop has been renamed to `<RemixStub future>`
