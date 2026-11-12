Keep client-only elements marked with `data-rmx-preserve-dom` during frame reloads that omit them. Portal hosts created during or after hydration stay connected, preserving focus, transitions, and scroll position. Removing their parent still removes them.

Elements present when `run()` starts, adopted when a standalone root hydrates a server frame, or supplied by later frame HTML retain their existing server-controlled lifetime: omitting them removes them, and removing the preservation attribute resumes normal reconciliation. If server HTML matches a client-only host, the server takes control of its lifetime too. Use stable `data-rmx-key` values to distinguish same-tag client hosts and server widgets.

Preserved server styles in `<head>` stay in place when other head elements are removed, even beside client-created preserved styles.
