# Data model forms demo

Four routes show schema-backed native forms connected to in-memory SQLite. Applications own labels, controls, and error markup.

## Run it

From the repository root:

```sh
pnpm install
pnpm -C demos/data-model-forms dev
```

Open <http://localhost:44100>. The root redirects to `/schema`.

## Examples

Form schemas come from `remix/data-schema/form`; `@remix-run/ui/form` supplies Context, role mixins, and safe failed-submission parsing. Domain rules come from `remix/data-schema`. See the [form guide](https://github.com/remix-run/remix/blob/main/packages/ui/src/form/README.md) for API examples, including multi-schema composition.

| Route                                                                                                           | What it demonstrates                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [`/schema`](https://github.com/remix-run/remix/tree/main/demos/data-model-forms/app/actions/schema)             | `fd.object()` reuses `Account.shape` rules and omits the server-owned id.                                                                     |
| [`/fields`](https://github.com/remix-run/remix/tree/main/demos/data-model-forms/app/actions/fields)             | Stable typed field bindings pass through props to child components, which render live feedback.                                               |
| [`/extra-fields`](https://github.com/remix-run/remix/tree/main/demos/data-model-forms/app/actions/extra-fields) | Model fields plus reusable password and inline terms fields. Password and terms are validated but never stored; failed values omit passwords. |
| [`/inline`](https://github.com/remix-run/remix/tree/main/demos/data-model-forms/app/actions/inline)             | `fd.object()` with inline validations and no separate domain schema.                                                                          |

The extra-fields example maps requiredness and minimum-length messages with `errorMap`, while its whitespace refinement keeps an explicit schema message. The inline example omits that refinement message and maps `refine.failed` instead.

## Try it

- Use **Fill demo values**, add spaces around the display name, and blur it to see a schema refinement rendered inline.
- Edit an invalid field after blur: native-first validation and live `errors` / `touched` state update the error UI.
- Disable JavaScript and submit `a@b` as the email. Native email validation accepts it, but the server schema returns a populated form with a field error. Native tooltips retain browser wording.

Successful submissions redirect back to their example. Saved accounts appear on every page until the process exits. Controllers supply ids and select persisted fields; the table validates complete writes with `Account`. Cross-field checks remain a separate handler step.

## Key files

- `app/actions/{schema,fields,extra-fields,inline}/` contains each controller and page; colocated `public/` folders contain browser components and definitions.
- `app/data/public/account-schema.ts` holds schemas shared by browser validation and database writes. Table definitions and SQLite setup remain outside the browser asset boundary.
- `app/ui/example-page.tsx` shares navigation and saved-account output.
- `app/middleware/render.tsx` wraps documents by default. Handlers can set `document: { title }`, pass `responseInit`, or use `document: false` for partial HTML.

## Verify it

```sh
pnpm -C demos/data-model-forms typecheck
```

Browser behavior is covered by the UI package tests; verify the demo through native and server submissions.
