---
name: debug-issues
description: Debug interactive or hard-to-reproduce issues with a hypothesis-driven loop. Use when a bug needs explicit hypotheses, temporary logging sent to a web server via fetch instead of console.log, user-confirmed reproduction steps, and then log review to validate or reject the hypotheses before fixing anything.
---

# Debug Issues

Use this skill when the goal is to understand a bug before changing the implementation.

## Workflow

1. Start with hypotheses.

- Write down the most likely explanations for the bug.
- Keep them concrete and falsifiable.
- Prefer a short list over a broad brainstorm.

2. Add temporary logging to the code.

- Do not rely on `console.log`.
- Send debug events to a web server with `fetch(...)`.
- Prefer the bundled server in `scripts/debug_log_server.ts`.
- Log the minimum useful facts: event name, timing/order, relevant state, relevant DOM attributes, and identifiers.
- Keep the instrumentation easy to remove.

3. Stop and hand off reproduction.

- Tell the user the exact steps to reproduce the issue.
- After giving the steps, explicitly note that the user can reply with `r` for reproduced.
- Do not continue the debugging loop until the user confirms the issue was reproduced.

4. Review the logs after reproduction.

- Compare the observed event/state order against the hypotheses.
- Explicitly mark each hypothesis as supported, rejected, or still unclear.
- If the first round of logs leaves important questions unanswered, update the instrumentation to target the remaining uncertainty and repeat the reproduction loop.

5. Only then decide on the fix.

- Make the smallest change that addresses the validated cause.
- Keep the temporary debug logging in place while validating the fix.
- After handing back a fix to validate, explicitly note that the user can reply with `f` for fixed.
- Remove the temporary debug logging only after the user confirms the bug is fixed.

## Rules

1. Prefer server-visible debug logs over local console output.

- Use `fetch` to send structured debug payloads to a local/debug endpoint.
- Default endpoint: `http://127.0.0.1:43210/__debug/log`
- Keep payloads JSON and timestamped when ordering matters.

2. Reproduction is a checkpoint.

- After adding instrumentation, stop and ask the user to reproduce the issue.
- Wait for confirmation before analyzing results.

3. Treat logs as evidence, not decoration.

- Every logged field should help validate or reject a hypothesis.
- If a log line does not help make a decision, remove it.
- As hypotheses are confirmed or rejected, revise the instrumentation so it tracks the current leading questions instead of stale ones.

4. Keep debug patches temporary and isolated.

- Name debug-only code clearly.
- Avoid mixing debug instrumentation with permanent behavior changes.
- Do not remove instrumentation immediately after landing a fix. Keep it until the user confirms the fix worked.

5. Summarize conclusions explicitly.

- For each hypothesis, say whether the logs support it.
- Call out the exact event ordering or state transition that explains the bug.

## Good Fit

- Popup, focus, hydration, event ordering, and animation bugs
- Cases where user interaction in a real browser matters
- Bugs where the observed behavior and the intended state machine seem out of sync

## Bundled Tool

Start the debug server with:

```bash
node .agents/skills/debug-issues/scripts/debug_log_server.ts --reset
```

Available endpoints:

- `POST /__debug/log`
- `POST /__debug/clear`
- `GET /__debug/logs`
- `GET /__debug/health`

Default behavior:

- listens on `127.0.0.1:43210`
- stores JSONL at `.agents/skills/debug-issues/tmp/debug-log.jsonl`
- allows browser `fetch(...)` calls from local demos via permissive CORS

## Not The Goal

- Blindly trying fixes without evidence
- Permanent analytics-style logging
- Using console output as the primary debugging channel
