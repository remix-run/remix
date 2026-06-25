# Security Policy

## Supported Versions

The following versions of `remix` are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 3.x     | :white_check_mark: |
| <= 2.x  | :x:                |

If you are looking to report an issue with Remix v1/2, you should report that issue in [React Router](https://github.com/remix-run/react-router). Remix v2 was [upstreamed](https://remix.run/blog/wake-up-remix) into React Router v7.

## Reporting a Vulnerability

We take security bugs in Remix seriously. We appreciate your efforts to responsibly disclose your findings, and will make every effort to acknowledge your contributions.

To report a security issue, please use the GitHub Security Advisory [Report a Vulnerability](https://github.com/remix-run/remix/security/advisories/new) feature.

The Remix team will send a response indicating the next steps in handling your report. After the initial reply to your report, our team will keep you informed of the progress towards a fix and full announcement, and may ask for additional information or guidance.

Generally, the full process will look something like this when we receive a new advisory via Github:

- If the advisory is valid, we'll move it into `Draft` status as we begin our investigation
- We'll publish a new version of Remix with a fix
- We'll update our own sites with the new version
- We'll inform common hosting platforms of the vulnerability so they can make any preventative changes on their end even before the vulnerability is fixed/published
- After a period of time, potentially up to a month or so, we'll publish the advisory
  - This gives application developers time to update their applications to the latest version before we make the details of the advisory public

Report security bugs in third-party modules to the person or team maintaining the module. You can also report a vulnerability through the [npm contact form](https://www.npmjs.com/support) by selecting "I'm reporting a security vulnerability".
