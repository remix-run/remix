Fix Firefox browser tests stalling during history navigation. Firefox test files run in separate windows after loading, while Chromium and WebKit retain their existing iframe startup behavior.
