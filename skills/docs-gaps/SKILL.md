---
name: docs-gaps
description: Identify gaps in documentation by validating that necessary types are exported and that exported types have valid JSDocs comments. This skill helps maintain accurate and concise API documentation by checking for unreferenced/undocumented exports and adjusting them accordingly.
---

# Documentation Gaps

## Overview

Use this skill to identify gaps in documentation by validating that necessary types are exported and that exported types have valid JSDocs comments.

## Workflow

This workflow applies for a single package. If operating on multiple packages, repeat for each package and commit individually. All work should be done from the `docs/` directory for proper execution of scripts.

### Phase 1 - Silence warnings for non-exported types

Generate documentation by running `pnpm run docs` from the `docs/` directory and look for any output of the format `[warning] {API}, defined in {FILE}, is referenced by {API} but not included in the documentation` that are referring to APIs within the package.

For each warning, add the type name to the package's `typedoc.json` file under `intentionallyNotExported`. Create the file if it doesn't exist:

```json
{
  "intentionallyNotExported": ["TypeName1", "TypeName2"]
}
```

Repeat until all such warnings for the current package are gone. Commit these changes.

#### Phase 2 - Look for stale intentionallyNotExported entries

After silencing warnings for non-exported types, look for any entries in `intentionallyNotExported` that are no longer necessary (i.e. the type is now exported and included in the docs). Remove these entries and commit the change.

### Phase 3 - Make sure all exported types have valid JSDocs comments

Generate docs via `pnpm run docs` and look for warnings of the format `WARN: missing comment for API: {API}` for APIs in the current package. For each of these, review the source code and add a JSDoc comment at the definition-site of that API.

Repeat until all warnings for the current package are gone.
