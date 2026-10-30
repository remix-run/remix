-- Starter guestbook entries. `insert or ignore` keeps the seed safe to re-run.
insert or ignore into entries (id, name, message, signed_at) values
  (1, 'Grace', 'The form below hydrates on the client, but works without JavaScript too.', 1756900800000),
  (2, 'Ada', 'Hello from the server. This page was rendered by Preact.', 1756901100000);
