Keep `createHtmlResponse`'s generated doctype in the first body chunk for streamed responses so consumers that inspect the first chunk still see the document content.
