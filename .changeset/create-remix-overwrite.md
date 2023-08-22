---
"create-remix": minor
---

Remove empty directory checking in favor of `overwrite` prompt/flag.

`create-remix` now allows you to write into an existing non-empty directory. It will perform a file-level comparison and if the template will overwrite any existing files in the destination directory, it will prompt you if it's OK to overwrite those files. If you answer no (the default) then it will exit without copying any files. You may skip this prompt with the `--overwrite` CLI flag.
