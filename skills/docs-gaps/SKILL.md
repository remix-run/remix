---
name: docs-gaps
description: Identify gaps in documentation by ensuring all exported types have valid JSDocs comments. This skill helps maintain accurate API documentation by finding and filling missing JSDoc comments on exported APIs.
---

# Documentation Gaps

## Overview

Use this skill to identify gaps in documentation by ensuring all exported types have valid JSDocs comments.

## Workflow

Note: This workflow applies for a single package. If operating on multiple packages, repeat for each package and commit individually. All work should be done from the `docs/` directory for proper execution of scripts.

Generate docs via `pnpm run docs` and look for warnings of the following formats:

- `WARN: missing comment for API: {API}`
- `WARN: missing comment for signature: {signature}`

For each of these, review the source code and add an appropriate JSDoc comment at the definition-site of that API/signature (refer to the guidelines in the [`jsdoc` skill](../jsdoc/SKILL.md)).

Repeat until all warnings for the current package are gone. Commit these changes.
