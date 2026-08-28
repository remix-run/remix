---
title: Forms and Mutations
description: How native forms, action responses, validation failures, redirects, and enhanced mutations fit together.
---

Build the mutation as an HTML form and controller action first. Once the non-JavaScript request returns the right response, the same form can gain pending state, fetch submission, or a targeted frame reload.

## HTML-first form workflows {#html-first-form-workflows}

Use a real `<form method="POST">`, named native controls, and a submit button. The action URL comes from `routes.<name>.href(...)`, and the controller returns an explicit `Response` for every expected outcome.

## Form routes and controller ownership {#form-routes}

`form(path)` creates an `index` GET leaf and an `action` POST leaf by default. Keep both direct leaves in the controller mapped to that form route map, and use custom action names or methods only when the URL contract benefits from them.

## Parse FormData once, then validate it {#parse-and-validate-form-data}

Install `formData()` before middleware that depends on form fields, read `context.get(FormData)`, and parse with a `remix/data-schema/form-data` schema. Treat missing fields, repeated fields, checkboxes, files, and coercion as boundary concerns rather than ad hoc action checks.

## Return validation failures with the form {#validation-failures}

Use `parseSafe()` and render the form again with issue paths, submitted values, and a `400` status. Keep entered values and error ownership close to the fields, while avoiding password or file-value replay.

## Redirect after a successful mutation {#post-redirect-get}

Return a `303` redirect to the resulting page after create, update, or delete work. This prevents accidental resubmission on refresh and gives the next GET a stable URL; session flash data can carry one-request success messages.

## Multiple submit intents and mutation responses {#mutation-intents-and-responses}

Use named submit buttons when one form has a small set of related intents. Choose the response that matches the caller: rendered HTML for an in-place failure, a redirect for normal browser success, or JSON for an endpoint genuinely consumed as data.

## PUT, PATCH, and DELETE from HTML forms {#method-override-for-put-patch-and-delete}

HTML forms submit GET or POST. Add a hidden `_method` field and run `methodOverride()` after `formData()` when the route contract uses PUT, PATCH, or DELETE, as the bookstore demo's RESTful form wrapper does.

## Enhance submissions without replacing the action {#enhanced-form-submissions}

A hydrated component may intercept submit, send `new FormData(form)` with the event's abort signal, and then navigate or reload a frame. The server action should remain correct when JavaScript fails to load or the enhancement is removed.

## Pending, optimistic, and conflicting mutations {#optimistic-ui}

Track the attempted operation in setup scope to disable duplicate controls and render pending or optimistic state. Reconcile with the returned response, roll back failures, and use app-owned revisions or preconditions when concurrent writes can conflict.

## When to return JSON {#resource-routes-and-json-endpoints}

Use JSON for autocomplete, polling, isolated widgets, APIs, and inter-service calls. Do not create a parallel JSON mutation layer for a form that already has a useful HTML response and redirect path.
