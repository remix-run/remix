# Codex PR Automation

This directory contains setup notes for the Codex-powered pull request workflows
in `.github/workflows/`.

## Workflows

- `codex-pr-review.yaml` posts an automatic Codex review comment on new or
  updated pull requests.

## Required Secrets

- `OPENAI_API_KEY`: API key used by `openai/codex-action`.

## Usage

- Automatic review runs on `opened`, `reopened`, `ready_for_review`, and
  `synchronize` pull request events.
- Draft pull requests are reviewed too.
- Same-repo pull requests use `pull_request`, so the review workflow can run
  immediately from the PR branch before the workflow is merged to `main`.
- Fork pull requests use `pull_request_target`, so they can still be reviewed
  safely after the workflow exists on `main`.
- The review workflow is read-only. It reviews the diff and may reference the
  current CI check state, but it does not run repository validations or push
  commits back to the PR.
- If a review comment needs follow-up work, address it locally with Codex or
  through the normal development workflow, then push the resulting commit(s).

## Limitations

- The review workflow can evaluate PRs from forks because it only needs read
  access.
- This workflow uses the OpenAI API through `openai/codex-action`, so a Codex
  or ChatGPT subscription alone is not enough to power the GitHub Actions runs.
