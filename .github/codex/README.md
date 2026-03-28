# Codex PR Automation

This directory contains setup notes for the Codex-powered pull request workflows
in `.github/workflows/`.

## Workflows

- `codex-pr-review.yaml` posts an automatic Codex review comment on new or
  updated pull requests.
- `codex-pr-fix.yaml` lets maintainers ask Codex to make changes on a pull
  request branch by leaving a top-level PR comment that starts with `/codex` or
  `@codex`.

## Required Secrets

- `OPENAI_API_KEY`: API key used by `openai/codex-action`.
- `GH_REMIX_PAT`: existing PAT already used by other Remix workflows to push
  commits back to branches and re-trigger CI. The Codex fix workflow reuses this
  secret. If you want Codex-authored commits to be able to update workflow
  files, this token also needs workflow-writing permission.

## Usage

- Automatic review runs on `opened`, `reopened`, `ready_for_review`, and
  `synchronize` pull request events.
- Draft pull requests are reviewed too.
- Same-repo pull requests use `pull_request`, so the review workflow can run
  immediately from the PR branch before the workflow is merged to `main`.
- Fork pull requests use `pull_request_target`, so they can still be reviewed
  safely after the workflow exists on `main`.
- To ask Codex to edit a PR branch, add a PR conversation comment such as:

  ```text
  /codex add the missing tests for the new loader behavior
  ```

  ```text
  @codex tighten the docs and fix the failing typecheck
  ```

## Limitations

- The review workflow can evaluate PRs from forks because it only needs read
  access.
- The fix workflow only pushes changes for PRs whose head branch lives in
  `remix-run/remix`. It intentionally skips fork-based PRs.
- These workflows use the OpenAI API through `openai/codex-action`, so a Codex
  or ChatGPT subscription alone is not enough to power the GitHub Actions runs.
