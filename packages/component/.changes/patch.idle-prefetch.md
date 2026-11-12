Pending viewport prefetches pause while the document is hidden and resume with fresh visibility and eligibility checks when it becomes visible. Intent and imperative triggers keep their existing timing.

Default prefetching waits for idle time before parsing downloaded HTML and discovering assets. The idle callback has a one-second timeout so busy pages can still make progress; browsers without idle callbacks yield through a timer. Runtime disposal cancels pending viewport work and HTML discovery.
