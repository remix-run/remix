# Maintaining Remix

This document covers repository operations for Remix maintainers. For the community contribution
workflow and local development instructions, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Releases

Releases are automated by the
[`release-pr` workflow](https://github.com/remix-run/remix/blob/main/.github/workflows/release-pr.yaml)
and the
[`publish` workflow](https://github.com/remix-run/remix/blob/main/.github/workflows/publish.yaml).

1. Changes are pushed to `main` with change files in `packages/<package>/.changes/`
2. A Release pull request is automatically opened, or updated if one exists
   - It contains updated `package.json` versions, updated `CHANGELOG.md` files, and deleted change files
   - Do not edit this pull request manually
   - Modify the change files or release scripts on `main` to trigger an update
3. Merging the Release pull request triggers the publish workflow
   - Since the change files have been deleted, it publishes all unpublished packages to npm
   - It then creates Git tags and GitHub releases for the packages that were published

### Manual Versioning

The Release pull request automates the `pnpm changes:version` command. If needed, run the command
manually to update package versions and changelogs, delete change files, and commit the result:

```sh
pnpm changes:version
```

Use `--no-commit` to leave the changes staged for review. The command also prints the commit
message it would have used:

```sh
pnpm changes:version --no-commit
```

Tags and GitHub releases are created automatically by the publish workflow after a successful npm
publish.

### Prerelease Mode

Packages can opt into prerelease mode by creating an optional `.changes/config.json` file:

```json
{
  "prereleaseChannel": "alpha",
  "prereleaseStart": 0
}
```

The `prereleaseChannel` determines the version suffix, such as `alpha`, `beta`, or `rc`.
`prereleaseStart` optionally sets the first number for a new channel and defaults to `0`.
Prereleases are always published to npm with the `next` tag. This is currently used for `remix`.

#### Bumping Prerelease Versions

While in prerelease mode, add change files normally. The prerelease counter increments, for
example from `3.0.0-alpha.1` to `3.0.0-alpha.2`. Changelog entries are grouped under
"Pre-release Changes", and the bump type is otherwise ignored.

#### Transitioning Between Prerelease Channels

To transition between channels, such as `alpha` to `beta`:

1. Update `prereleaseChannel` in `.changes/config.json` to the new channel.
2. Set `prereleaseStart` if the new channel should not start at `0`.
3. Add a change file describing the transition.

The version resets to the new channel, for example from `3.0.0-alpha.7` to `3.0.0-beta.0`. The
bump type is used only for changelog categorization; by convention, use `patch`.

#### Graduating a Prerelease Package to Stable

To release the stable version:

1. Remove `prereleaseChannel` from `.changes/config.json`, or delete the file.
2. Add a change file describing the stable release.

The prerelease suffix is removed, for example from `3.0.0-rc.7` to `3.0.0`. The bump type is used
only for changelog categorization; by convention, use `major` for a major release announcement.

## Preview Builds

The `preview/main` branch provides installable builds of `main` without publishing releases to npm.
The
[`preview` workflow](https://github.com/remix-run/remix/blob/main/.github/workflows/preview.yml)
runs [`setup-installable-branch.ts`](./scripts/setup-installable-branch.ts) after every commit to
`main`. The script builds the repository and commits the build output and required `package.json`
changes to `preview/main`.

The `preview/main` build can be installed directly with pnpm 9 or newer:

```sh
pnpm install "remix-run/remix#preview/main&path:packages/remix"

# Or install a single package
pnpm install "remix-run/remix#preview/main&path:packages/fetch-router"
```

## Agentic Workflows

Remix has a handful of administrator-only [agentic workflows](https://github.github.com/gh-aw/) and
an agentic [comment-driven router workflow](./.github/workflows/aw-comment-router.md)
to provide natural language routing to relevant workflows. Workflows can do things such as triage
an issue, review a pull request, implement an issue or accepted Proposal Discussion, or iterate on
a pull request.

```mermaid
flowchart LR
  Admin[Repo admin]
  Admin -->|Slash command,\naw:* label| Command[Command workflow]
  Admin -->|Comment @remix-run-bot| Router[Comment router]
  Router -->|Ambiguous request| Clarify[Ask one clarifying question]
  Router -->|Validated workflow dispatch| Command
  Command --> Request[Resolve trusted request]
  Request --> GH[Run agent, Threat detection, Safe outputs]
  GH --> Result[Comment, close issue, draft PR, or update PR branch]
```

### Available Commands

| Command      | Where                                 | Direct triggers                                                                 | Result                                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/triage`    | Issue                                 | Comment beginning with `/triage`, or apply `aw:triage`                          | Investigates the report and duplicates. It may ask for information, explain a likely fix, or comment and close only a clear duplicate, proposal, support request, spam, or out-of-scope issue. It never edits code.                                             |
| `/review`    | Pull request                          | Comment beginning with `/review`, or apply `aw:review`                          | Posts one read-only review comment with high-confidence P1-P3 findings. It never checks out or executes contributor code, edits the pull request, approves it, or merges it.                                                                                    |
| `/implement` | Issue or accepted Proposal Discussion | Comment beginning with `/implement`; `aw:implement` is also available on issues | Implements a focused change from trusted `main`, validates it, and opens at most one draft pull request. If protected or disallowed files are required, it falls back to an issue instead.                                                                      |
| `/iterate`   | Pull request                          | Comment beginning with `/iterate`, or apply `aw:iterate`                        | Applies administrator feedback. It can update a branch in `remix-run/remix` or `remix-run-bot/remix`; for any other fork it creates a bot-owned replacement draft and closes the original only after verifying both pull requests. It never merges or approves. |

Slash-command comments may include instructions after the command. For example:

```text
/review Focus on the new public API and its compatibility with existing adapters.
```

Applying an `aw:*` label carries no instructions. It invokes the command's default behavior, and
the label is removed after triggering (per `gh-aw` `label_command` trigger). For `/iterate`, the default label behavior uses the most recent agentic review as supporting data.

### Comment Router

An administrator can use natural language instead of choosing a command by mentioning
`@remix-run-bot` in a new issue, pull request, or Discussion comment. For example:

```text
@remix-run-bot review this pull request, focusing on the new cache invalidation behavior.
```

The
[`comment router`](./.github/workflows/aw-comment-router.md)
reads only the sanitized administrator comment and whether its target is an issue, pull request, or
Discussion. It chooses exactly one command or asks one concise clarification question. The valid
routes are:

- Issue: `triage` or `implement`
- Pull request: `review` or `iterate`
- Proposal Discussion: `implement`

The router briefly applies the matching `aw:*` label to issues and pull requests, queues the command
with `workflow_dispatch`, and removes the label without waiting for the command run to finish.
Discussions do not use a label. The dispatched command revalidates the router run, original target,
comment ID and hash, administrator identity, exact bot mention, and expected command before it
trusts the comment. Editing the source comment after it was routed invalidates the request; post a
new comment instead.

### Trust and Credentials

Repository administrators are the only authorized callers. Slash commands and labels are
restricted by the workflow trigger, and the router and manual-label path independently verify
administrator permission. Labels applied by `remix-run-bot` cannot trigger a command; this prevents
the router's temporary label from starting a second run.

The workflows require these repository secrets:

- `OPENAI_API_KEY_SHOPIFY` provides model access through `https://proxy.shopify.ai/v1`.
- `GH_REMIX_PAT` authenticates as `remix-run-bot`. It needs Actions write access to dispatch command
  workflows, Issues write access to manage temporary labels and post issue or pull request comments,
  Discussions write access to reply to Discussions, and Contents and Pull requests write access to
  create or update pull requests.

All ordinary repository inspection uses the run's read-only `GITHUB_TOKEN`. The bot PAT is supplied
only to safe-output and router jobs that need to write, and is not available to the agent process.
Every agent output is inspected by a detection job before the output jobs run. Built-in safe-output
processing requires detection to succeed.

The workflows intentionally limit the files that `/implement` and `/iterate` may change. Protected
workflow, configuration, generated, and agent-instruction files cannot be changed. Root `README.md`
is an explicit exception to the default protected-file policy. `/implement` can execute trusted
repository code and focused validation from `main`; `/iterate` does not execute contributor code and
relies on normal pull request CI for final validation.

### Viewing Runs and Logs

In GitHub, open the repository's **Actions** tab and select one of these workflows:

- [Remix bot comment router](https://github.com/remix-run/remix/actions/workflows/aw-comment-router.lock.yml)
- [/triage](https://github.com/remix-run/remix/actions/workflows/aw-command-triage.lock.yml)
- [/review](https://github.com/remix-run/remix/actions/workflows/aw-command-review.lock.yml)
- [/implement](https://github.com/remix-run/remix/actions/workflows/aw-command-implement.lock.yml)
- [/iterate](https://github.com/remix-run/remix/actions/workflows/aw-command-iterate.lock.yml)

A routed request creates two independent runs: the comment-router run and, after dispatch, the
selected command run. The router does not wait for the command to finish. Use the triggering
comment's timestamp and the command name to correlate them.

The same information is available with `gh`:

```sh
# Find recent router or command runs
gh run list --workflow aw-comment-router.lock.yml --limit 10
gh run list --workflow aw-command-review.lock.yml --limit 10

# Inspect the job results, failed steps, or complete log
gh run view <run-id> --json jobs,conclusion,url
gh run view <run-id> --log-failed
gh run view <run-id> --log

# Open the run in a browser
gh run view <run-id> --web

# Download prompts, redacted agent logs, safe-output data, and detection artifacts
agentic_run_dir="$(mktemp -d)"
gh run download <run-id> --dir "$agentic_run_dir"
```

Skipped runs are expected. The underlying workflows receive common issue or pull request events,
then their generated conditions discard comments, labels, targets, actors, and commands that do not
match.

### Debugging Failed Runs

When an agentic workflow fails, `gh-aw` will usually open an issue ([sample](https://github.com/remix-run/remix/issues/11776)) which will include details and usually an agent prompt to debug the specific failure using their `debug` skill. The easiest way to debug is to just paste that prompt into your agent - something like:

```sh
Debug the agentic workflow failure using https://raw.githubusercontent.com/github/gh-aw/main/debug.md

The failed workflow run is at https://github.com/remix-run/remix/actions/runs/[RUN_ID]
```

Before rerunning a failed job, verify whether any comment, closure, branch push, or draft pull
request already succeeded. Safe outputs are tightly constrained but are not all inherently
idempotent. After fixing a trigger or stale-comment problem, prefer posting a new command comment or
reapplying the label. If `/iterate` reports that the pull request head changed, always issue a new
command against the latest head.

### Editing the Workflows

The human-authored sources are the Markdown files under `.github/workflows/`, including the shared
[`resolve-command-request.md`](https://github.com/remix-run/remix/blob/main/.github/workflows/shared/resolve-command-request.md)
import. The `.lock.yml` files are generated. Never edit them by hand.

After changing a source, regenerate affected workflow, for example:

```sh
gh aw compile aw-comment-router --strict --validate --actionlint --shellcheck --poutine
```

Review both the Markdown source and generated lock-file diff. Use `--approve` only when intentionally
accepting a new action or secret reference, and inspect the exact addition before approving it.
