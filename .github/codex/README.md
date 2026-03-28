# Codex PR Automation

This directory contains setup notes for the Codex-powered review workflow and the
consolidated CI workflows in `.github/workflows/`.

## Workflows

- `check-pr.yaml` is the primary pull request validation workflow. It runs the
  core PR checks and invokes Codex only after all required validation jobs are
  green.
- `check-main.yaml` is the consolidated validation workflow for pushes to
  `main`.
- `codex-pr-review.yaml` is the fork-only fallback Codex review workflow. It
  waits for the PR validation checks to finish and only posts a review when the
  required checks passed.

## Required Secrets

- `OPENAI_API_KEY`: API key used by `openai/codex-action`.

## Usage

- `Check PR` runs on `opened`, `reopened`, `ready_for_review`, and
  `synchronize` pull request events.
- Draft pull requests are reviewed too, but Codex only runs after all required
  PR validation jobs passed.
- Same-repo pull requests get their Codex review from the final `Codex PR
review` job inside `check-pr.yaml`.
- Fork pull requests use the separate `pull_request_target` fallback review
  workflow so the OpenAI API key stays isolated from untrusted PR execution.
- Codex review is read-only. It reviews the diff and references final CI
  validation state, but it does not run repository validations or push commits
  back to the PR.
- `Preview Build` and `Update Remix package` remain separate workflows and are
  not part of the Codex review dependency graph.
- If a review comment needs follow-up work, address it locally with Codex or
  through the normal development workflow, then push the resulting commit(s).

## Limitations

- The fork review workflow waits for the orchestrated PR validation checks, so a
  failing PR will not receive a Codex review comment.
- This workflow uses the OpenAI API through `openai/codex-action`, so a Codex
  or ChatGPT subscription alone is not enough to power the GitHub Actions runs.
