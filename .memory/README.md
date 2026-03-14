# Memory

This directory stores durable project memory for the repository.

These memory files are dynamic.

- update them when preferences become clearer
- update them when decisions change
- update them when work is completed or reprioritized
- update them when screenshot reviews or implementation passes teach us something worth preserving

Organization:

- create one folder per memory category
  - examples: `design-system/`, `release/`, `routing/`, `docs/`
- each category folder may include its own `README.md`
  - describe what that category tracks
  - explain the files inside it
  - document any category-specific update rules

Suggested file roles within a category:

- `preferences.md` should change slowly
- `decisions.md` should only contain things we are willing to build around
- `worklog.md` can be updated often
- `visual-notes.md` should capture concrete design learnings, not generic taste
- `open-questions.md` should hold deferred ideas rather than active implementation notes

Guidelines:

- keep stable preferences separate from active work notes
- separate durable decisions from unresolved questions
- prefer updating existing memory over creating overlapping files
- keep each category focused so it is easy to consult before starting work
