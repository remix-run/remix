---
name: /triage
emoji: '🤖'
description: Re-run issue triage after an administrator requests it
on:
  roles: [admin]
  slash_command:
    name: triage
    events: [issue_comment]
  reaction: eyes
  status-comment: false
  skip-bots: [dependabot, renovate, github-actions, copilot]
permissions:
  contents: read
  issues: read
  pull-requests: read
checkout: false
model: gpt-5.6-terra
engine:
  id: codex
  env:
    OPENAI_BASE_URL: https://proxy.shopify.ai/v1
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY_SHOPIFY }}
strict: true
imports:
  - shared/triage-core.md
max-daily-ai-credits: 100
timeout-minutes: 12
---

Follow the imported issue-triage instructions for the triggering issue.
