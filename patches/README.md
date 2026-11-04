The `playwright-core@1.63.0` patch backports [Playwright #43605](https://github.com/microsoft/playwright/pull/43605), which disables Chromium TCP port randomization on Windows to avoid intermittent `ERR_NO_BUFFER_SPACE` failures during loopback requests. It updates both bundled copies of the default Chromium feature list.

Remove the patch when upgrading to a stable Playwright release that includes that fix.
