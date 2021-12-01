import { createFileUploadHandler } from "@remix-run/node";

export let uploadHandler = createFileUploadHandler({
  directory: "public/uploads",
  maxFileSize: 1234,
  // You probably do *not* want to do this in prod.
  // We passthrough the name and allow conflicts for test fixutres.
  avoidFileConflicts: false,
  file: ({ filename }) => filename
});
