---
"create-remix": minor
---

Remove empty directory checking in favor of `overwrite` prompt/flag.

`create-remix` now allows you to write into an existing non-empty directory.  It will perform a file-level comparison and if the template will overwrite any existing files in the destination directory, it will prompt you if it's OK to overwrite the files in the destination directory.  If you answer no (the default) then it will exit without copying any files into the destination directory.  You may skip this prompt with the `--overwrite` CLI flag.
