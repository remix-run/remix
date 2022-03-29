---
title: Remix Packages
---

# Remix Packages

<docs-info>The docs in this page have moved to their own pages</docs-info>

## Components and Hooks

### `<Links>`, `<LiveReload>`, `<Meta>`, `<Scripts>`, `<ScrollRestoration>`

- [Links Moved →][links-moved]
- [LiveReload Moved →][live-reload-moved]
- [Meta Moved →][meta-moved]
- [Scripts Moved →][scripts-moved]
- [ScrollRestoration Moved →][scroll-restoration-moved]

### `<Link>`

[Moved →][moved]

### `<PrefetchPageLinks />`

[Moved →][moved-68]

### `<NavLink>`

[Moved →][moved-2]

### `<Form>`

[Moved →][moved-3]

#### `<Form action>`

[Moved →][moved-4]

#### `<Form method>`

[Moved →][moved-5]

#### `<Form encType>`

[Moved →][moved-6]

#### `<Form replace>`

[Moved →][moved-7]

#### `<Form reloadDocument>`

[Moved →][moved-8]

### `<ScrollRestoration>`

[Moved →][moved-9]

### `useLoaderData`

[Moved →][moved-10]

### `useActionData`

[Moved →][moved-11]

#### Notes about resubmissions

[Moved →][moved-12]

### `useFormAction`

[Moved →][moved-13]

### `useSubmit`

[Moved →][moved-14]

### `useTransition`

[Moved →][moved-15]

#### `transition.state`

[Moved →][moved-16]

#### `transition.type`

[Moved →][moved-17]

#### `transition.submission`

[Moved →][moved-18]

#### `transition.location`

[Moved →][moved-19]

### `useFetcher`

[Moved →][moved-20]

#### `fetcher.state`

[Moved →][moved-21]

#### `fetcher.type`

[Moved →][moved-22]

#### `fetcher.submission`

[Moved →][moved-23]

#### `fetcher.data`

[Moved →][moved-24]

#### `fetcher.Form`

[Moved →][moved-25]

#### `fetcher.submit()`

[Moved →][moved-26]

#### `fetcher.load()`

[Moved →][moved-27]

#### Examples

[Moved →][moved-28]

### `useFetchers`

[Moved →][moved-29]

### `useMatches`

[Moved →][moved-30]

### `useBeforeUnload`

[Moved →][moved-31]

## HTTP Helpers

### `json`

[Moved →][moved-32]

### `redirect`

[Moved →][moved-33]

### `unstable_parseMultipartFormData`

[Moved →][moved-34]

### `uploadHandler`

[Moved →][moved-35]

#### `unstable_createFileUploadHandler`

[Moved →][moved-36]

#### `unstable_createMemoryUploadHandler`

[Moved →][moved-37]

### Upload Handler Composition

[Moved →][moved-38]

## Cookies

[Moved →][moved-39]

### Using cookies

[Moved →][moved-40]

### Cookie attributes

[Moved →][moved-41]

### Signing cookies

[Moved →][moved-42]

### `createCookie`

[Moved →][moved-43]

### `isCookie`

[Moved →][moved-44]

### Cookie API

[Moved →][moved-45]

#### `cookie.name`

[Moved →][moved-46]

#### `cookie.parse()`

[Moved →][moved-47]

#### `cookie.serialize()`

[Moved →][moved-48]

#### `cookie.isSigned`

[Moved →][moved-49]

#### `cookie.expires`

[Moved →][moved-50]

## Sessions

[Moved →][moved-51]

### Using Sessions

[Moved →][moved-52]

### Session Gotchas

[Moved →][moved-53]

### `createSession`

[Moved →][moved-54]

### `isSession`

[Moved →][moved-55]

### `createSessionStorage`

[Moved →][moved-56]

### `createCookieSessionStorage`

[Moved →][moved-57]

### `createMemorySessionStorage`

[Moved →][moved-58]

### `createFileSessionStorage` (node)

[Moved →][moved-59]

### `createCloudflareKVSessionStorage` (cloudflare-workers)

[Moved →][moved-60]

### `createArcTableSessionStorage` (architect, Amazon DynamoDB)

[Moved →][moved-61]

### Session API

[Moved →][moved-62]

#### `session.has(key)`

[Moved →][moved-63]

#### `session.set(key, value)`

[Moved →][moved-64]

#### `session.flash(key, value)`

[Moved →][moved-65]

#### `session.get()`

[Moved →][moved-66]

#### `session.unset()`

[Moved →][moved-67]

[links-moved]: ../components/links
[live-reload-moved]: ../components/live-reload
[meta-moved]: ../components/meta
[scripts-moved]: ../components/scripts
[scroll-restoration-moved]: ../components/ScrollRestoration
[moved]: ../components/link
[moved-2]: ../components/nav-link
[moved-3]: ../components/form
[moved-4]: ../components/form#action
[moved-5]: ../components/form#method
[moved-6]: ../components/form#enctype
[moved-7]: ../components/form#replace
[moved-8]: ../components/form#reloaddocument
[moved-9]: ../components/scroll-restoration
[moved-10]: ../hooks/use-loader-data
[moved-11]: ../hooks/use-action-data
[moved-12]: ../hooks/use-action-data#notes-about-resubmissions
[moved-13]: ../hooks/use-form-action
[moved-14]: ../hooks/use-submit
[moved-15]: ../hooks/use-transition
[moved-16]: ../hooks/use-transition#transitionstate
[moved-17]: ../hooks/use-transition#transitiontype
[moved-18]: ../hooks/use-transition#transitionsubmission
[moved-19]: ../hooks/use-transition#transitionlocation
[moved-20]: ../hooks/use-fetcher
[moved-21]: ../hooks/use-fetcher#fetcherstate
[moved-22]: ../hooks/use-fetcher#fetchertype
[moved-23]: ../hooks/use-fetcher#fetchersubmission
[moved-24]: ../hooks/use-fetcher#fetcherdata
[moved-25]: ../hooks/use-fetcher#fetcherform
[moved-26]: ../hooks/use-fetcher#fetchersubmit
[moved-27]: ../hooks/use-fetcher#fetcherload
[moved-28]: ../hooks/use-fetcher#examples
[moved-29]: ../hooks/use-fetchers
[moved-30]: ../hooks/use-matches
[moved-31]: ../hooks/use-before-unload
[moved-32]: ../utils/json
[moved-33]: ../utils/redirect
[moved-34]: ../utils/parse-multipart-form-data
[moved-35]: ../utils/parse-multipart-form-data#uploadhandler
[moved-36]: ../utils/unstable-create-file-upload-handler
[moved-37]: ../utils/unstable-create-memory-upload-handler
[moved-38]: ../guides/file-uploads#upload-handler-composition
[moved-39]: ../utils/cookies
[moved-40]: ../utils/cookies#using-cookies
[moved-41]: ../utils/cookies#cookie-attributes
[moved-42]: ../utils/cookies#signing-cookies
[moved-43]: ../utils/cookies#createcookie
[moved-44]: ../utils/cookies#iscookie
[moved-45]: ../utils/cookies#cookie-api
[moved-46]: ../utils/cookies#cookiename
[moved-47]: ../utils/cookies#cookieparse
[moved-48]: ../utils/cookies#cookieserialize
[moved-49]: ../utils/cookies#cookieissigned
[moved-50]: ../utils/cookies#cookieexpires
[moved-51]: ../utils/sessions
[moved-52]: ../utils/sessions#using-sessions
[moved-53]: ../utils/sessions#session-gotchas
[moved-54]: ../utils/sessions#createsession
[moved-55]: ../utils/sessions#issession
[moved-56]: ../utils/sessions#createsessionstorage
[moved-57]: ../utils/sessions#createcookiesessionstorage
[moved-58]: ../utils/sessions#creatememorysessionstorage
[moved-59]: ../utils/sessions#createfilesessionstorage-node
[moved-60]: ../utils/sessions#createworkerskvsessionstorage-cloudflare-workers
[moved-61]: ../utils/sessions#createarctablesessionstorage-architect-amazon-dynamodb
[moved-62]: ../utils/sessions#session-api
[moved-63]: ../utils/sessions#sessionhaskey
[moved-64]: ../utils/sessions#sessionsetkey-value
[moved-65]: ../utils/sessions#sessionflashkey-value
[moved-66]: ../utils/sessions#sessionget
[moved-67]: ../utils/sessions#sessionunset
[moved-68]: ../components/prefetch-page-links
